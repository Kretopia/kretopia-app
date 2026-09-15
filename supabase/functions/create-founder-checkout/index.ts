import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import { resolveFounderPriceId } from "../_shared/subscriptionPrices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FOUNDER_SPOTS = 1000;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FOUNDER-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is already a founder
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (profile?.subscription_tier === 'founder') {
      throw new Error("You're already a Founder Circle member!");
    }

    // Check spots remaining
    const { count } = await supabaseAdmin
      .from('founder_circle_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const spotsTaken = count || 0;
    logStep("Spots check", { spotsTaken, max: MAX_FOUNDER_SPOTS });

    if (spotsTaken >= MAX_FOUNDER_SPOTS) {
      throw new Error("Sorry, all Founder Circle spots have been claimed!");
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: resolveFounderPriceId(),
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=founder`,
      cancel_url: `${req.headers.get("origin")}/payment-canceled`,
      metadata: {
        user_id: user.id,
        type: 'founder_circle',
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Create pending purchase record
    await supabaseAdmin
      .from('founder_circle_purchases')
      .insert({
        user_id: user.id,
        stripe_session_id: session.id,
        status: 'pending',
      });

    return new Response(JSON.stringify({ url: session.url }), {
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
