import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_FEES: Record<string, number> = {
  'free': 0.15,
  'thriver': 0.15,
  'pro': 0.07,
  'creator_pro': 0.07,
};

const getPlatformFee = (tier: string | null): number => {
  return PLATFORM_FEES[tier || 'free'] || 0.15;
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-EVENT-TICKET] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { eventId } = await req.json();
    if (!eventId) throw new Error("Event ID is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get event details
    const { data: event, error: eventError } = await supabaseAdmin
      .from('creative_jams')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    logStep("Event found", { eventId, title: event.title, price: event.ticket_price });

    if (!event.is_ticketed || !event.ticket_price || event.ticket_price <= 0) {
      throw new Error("This event is not a ticketed event");
    }

    // Check if user already has a ticket
    const { data: existingTicket } = await supabaseAdmin
      .from('jam_participants')
      .select('id')
      .eq('jam_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingTicket) {
      throw new Error("You already have a ticket for this event");
    }

    // Get host profile for Stripe Connect
    const { data: hostProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, subscription_tier, full_name')
      .eq('user_id', event.created_by)
      .single();

    if (!hostProfile?.stripe_account_id) {
      throw new Error("Event host has not set up payment receiving. They need to connect their payment account first.");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Calculate platform fee
    const platformFeePercent = getPlatformFee(hostProfile.subscription_tier);
    const priceInCents = Math.round(event.ticket_price * 100);
    const applicationFee = Math.round(priceInCents * platformFeePercent);

    logStep("Fee calculation", {
      price: event.ticket_price,
      platformFeePercent,
      applicationFee: applicationFee / 100,
    });

    const origin = req.headers.get("origin") || "https://www.kretopia.com";
    const currency = (event.ticket_currency || 'usd').toLowerCase();

    // Create a pending order row *before* redirecting to Stripe. This is the
    // authoritative record that verify-event-ticket checks against after
    // payment -- the same mechanism the native (tiered) ticketing flow in
    // checkout-event-tickets/verify-event-ticket already uses. Access is
    // granted only once verify-event-ticket confirms with Stripe that this
    // specific order's checkout session was actually paid; it is never
    // granted from a client-supplied URL param alone.
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('event_orders')
      .insert({
        event_id: eventId,
        buyer_id: user.id,
        buyer_email: user.email,
        tier_id: null,
        quantity: 1,
        unit_price: event.ticket_price,
        subtotal: event.ticket_price,
        discount_amount: 0,
        total_amount: event.ticket_price,
        platform_fee: applicationFee / 100,
        currency: currency.toUpperCase(),
        status: 'pending',
      })
      .select()
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message || "Could not create order");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Ticket: ${event.title}`,
              description: event.description || `Event ticket for ${event.title}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: hostProfile.stripe_account_id,
        },
        metadata: {
          order_id: order.id,
          event_id: eventId,
          buyer_id: user.id,
          host_id: event.created_by,
          type: 'event_ticket',
        },
      },
      // tab=events ensures Discover mounts the "events" TabsContent (which
      // holds SessionsSection and its ticket_success/session_id handling) --
      // that panel is not mounted by default, so without this the redirect
      // would land on a page that never reads these params.
      success_url: `${origin}/discover?tab=events&ticket_success=${eventId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/discover?tab=events&ticket_cancelled=${eventId}`,
      metadata: {
        order_id: order.id,
        event_id: eventId,
        buyer_id: user.id,
        host_id: event.created_by,
        type: 'event_ticket',
      },
    });

    await supabaseAdmin
      .from('event_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    logStep("Checkout session created", { sessionId: session.id, orderId: order.id });

    return new Response(JSON.stringify({
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
