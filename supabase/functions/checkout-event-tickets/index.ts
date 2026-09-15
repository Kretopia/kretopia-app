import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_FEES: Record<string, number> = {
  free: 0.15,
  thriver: 0.15,
  pro: 0.07,
  creator_pro: 0.07,
};

const log = (s: string, d?: any) =>
  console.log(`[checkout-event-tickets] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Not authenticated");
    const { data: { user } } = await anon.auth.getUser(auth.replace("Bearer ", ""));
    if (!user?.email) throw new Error("Not authenticated");

    const body = await req.json();
    const { eventId, tierId, quantity = 1, promoCode } = body || {};
    if (!eventId || !tierId) throw new Error("eventId and tierId required");
    if (quantity < 1 || quantity > 50) throw new Error("Invalid quantity");

    const { data: event, error: evErr } = await admin
      .from("creative_jams")
      .select("id, title, description, created_by, ticket_currency, status")
      .eq("id", eventId)
      .single();
    if (evErr || !event) throw new Error("Event not found");
    if (event.status === "cancelled") throw new Error("Event is cancelled");

    const { data: tier, error: tErr } = await admin
      .from("event_ticket_tiers")
      .select("*")
      .eq("id", tierId)
      .eq("event_id", eventId)
      .single();
    if (tErr || !tier) throw new Error("Ticket tier not found");

    const now = new Date();
    if (tier.sale_starts_at && new Date(tier.sale_starts_at) > now)
      throw new Error("Sales have not started for this tier");
    if (tier.sale_ends_at && new Date(tier.sale_ends_at) < now)
      throw new Error("Sales have ended for this tier");
    if (quantity < tier.min_per_order) throw new Error(`Min ${tier.min_per_order} per order`);
    if (quantity > tier.max_per_order) throw new Error(`Max ${tier.max_per_order} per order`);
    // Fast, friendly pre-check only -- deliberately a plain read, not the
    // atomic enforcement point. For a paid tier the real "sale" doesn't
    // happen until Stripe confirms payment (verify-event-ticket), which can
    // be minutes later than this request; holding a DB row lock across that
    // gap (and across the Stripe API call below) isn't something this fix
    // does. The free-ticket branch below re-checks capacity atomically
    // right before granting access, since that grant *is* instantaneous.
    if (tier.quantity_total != null && tier.quantity_sold + quantity > tier.quantity_total)
      throw new Error("Not enough tickets remaining");

    const unitPrice = Number(tier.price);
    let subtotal = unitPrice * quantity;
    let discount = 0;
    let promoId: string | null = null;

    if (promoCode) {
      const { data: promo } = await admin
        .from("event_promo_codes")
        .select("*")
        .eq("event_id", eventId)
        .eq("code", promoCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      if (!promo) throw new Error("Invalid promo code");
      if (promo.valid_from && new Date(promo.valid_from) > now) throw new Error("Promo not yet active");
      if (promo.valid_until && new Date(promo.valid_until) < now) throw new Error("Promo expired");
      if (promo.max_uses != null && promo.uses_count >= promo.max_uses)
        throw new Error("Promo code fully redeemed");
      if (promo.applies_to_tier_ids?.length && !promo.applies_to_tier_ids.includes(tierId))
        throw new Error("Promo not valid for this tier");

      discount =
        promo.discount_type === "percent"
          ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
          : Math.min(subtotal, Number(promo.discount_value));
      promoId = promo.id;
    }

    const total = Math.max(0, subtotal - discount);
    const currency = (tier.currency || event.ticket_currency || "usd").toLowerCase();

    const { data: host } = await admin
      .from("profiles")
      .select("stripe_account_id, subscription_tier")
      .eq("user_id", event.created_by)
      .single();
    if (!host?.stripe_account_id)
      throw new Error("Host has not connected payouts yet");

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    // stripe_account_id alone only means Connect onboarding was started -- Stripe
    // doesn't grant the `transfers` capability a destination charge requires until
    // the account is fully verified (a rejected/disabled account still keeps its
    // id on file). Skip for free tickets: no charge, nothing to transfer.
    if (total > 0) {
      const account = await stripe.accounts.retrieve(host.stripe_account_id);
      if (account.capabilities?.transfers !== "active") {
        throw new Error("Host hasn't finished setting up payouts yet — please try again later.");
      }
    }

    const platformFeePct = PLATFORM_FEES[host.subscription_tier || "free"] || 0.15;
    const totalCents = Math.round(total * 100);
    const applicationFee = Math.round(totalCents * platformFeePct);

    // Create order row first (pending)
    const { data: order, error: orderErr } = await admin
      .from("event_orders")
      .insert({
        event_id: eventId,
        buyer_id: user.id,
        buyer_email: user.email,
        tier_id: tierId,
        quantity,
        unit_price: unitPrice,
        subtotal,
        discount_amount: discount,
        promo_code_id: promoId,
        platform_fee: applicationFee / 100,
        total_amount: total,
        currency: currency.toUpperCase(),
        status: "pending",
      })
      .select()
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const origin = req.headers.get("origin") || "https://www.thrivein.io";

    // Free tickets: no Stripe needed, mark paid immediately.
    if (totalCents === 0) {
      // Atomic check-and-increment: locks the tier row, re-checks capacity,
      // and writes quantity_sold in a single statement -- closes the TOCTOU
      // race between the plain-read capacity check above and this grant
      // (two concurrent free-ticket claims could otherwise both read the
      // same quantity_sold and both pass). See reserve_event_ticket_capacity()
      // in 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql.
      const { data: reservation, error: reserveErr } = await admin
        .rpc("reserve_event_ticket_capacity", { _tier_id: tierId, _quantity: quantity })
        .single();
      if (reserveErr) throw new Error(reserveErr.message);
      if (!reservation?.allowed) {
        await admin.from("event_orders").update({ status: "cancelled" }).eq("id", order.id);
        throw new Error("Not enough tickets remaining");
      }

      await admin.from("event_orders").update({ status: "paid" }).eq("id", order.id);
      if (promoId) {
        await admin.rpc("increment_promo_use", { _id: promoId }).catch(() => {});
      }
      // 'going' matches jam_participants_status_check and every other RSVP
      // code path (rsvp_to_event, EventPage.tsx, SessionCard.tsx, ...) --
      // this used to write 'rsvp', a value the constraint has never
      // allowed, so the upsert was silently failing (error not checked) on
      // every free ticket claim and the buyer never actually joined the
      // guest list.
      await admin.from("jam_participants").upsert({
        jam_id: eventId,
        user_id: user.id,
        status: "going",
      }, { onConflict: "jam_id,user_id" });

      return new Response(
        JSON.stringify({
          free: true,
          orderId: order.id,
          redirectUrl: `${origin}/event/${eventId}?ticket=success&order=${order.id}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${event.title} — ${tier.name}`,
              description: tier.description || event.description || undefined,
            },
            unit_amount: Math.round((total / quantity) * 100),
          },
          quantity,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: host.stripe_account_id },
        metadata: {
          order_id: order.id,
          event_id: eventId,
          tier_id: tierId,
          buyer_id: user.id,
          host_id: event.created_by,
          quantity: String(quantity),
          promo_code_id: promoId || "",
        },
      },
      success_url: `${origin}/event/${eventId}?ticket=success&order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/event/${eventId}?ticket=cancelled`,
      metadata: { order_id: order.id, event_id: eventId },
    }, { idempotencyKey: `event-ticket-checkout-${order.id}` });

    await admin.from("event_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    log("session created", { orderId: order.id });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id, orderId: order.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
