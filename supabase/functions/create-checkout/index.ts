import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";
import {
  isSubscriptionInterval,
  isSubscriptionPlanKey,
  resolveSubscriptionPriceId,
} from "../_shared/subscriptionPrices.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { tier, interval } = await req.json();
    if (!isSubscriptionPlanKey(tier)) throw new Error("A valid subscription tier is required");
    if (!isSubscriptionInterval(interval)) throw new Error("A valid billing interval is required");

    // Resolved server-side (not trusted from the client) so the Price ID
    // always matches the active STRIPE_MODE — see _shared/subscriptionPrices.ts.
    const priceId = resolveSubscriptionPriceId(tier, interval);

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil"
    });
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if this customer already had a subscription (no trial for returning users)
    let hadPreviousSub = false;
    if (customerId) {
      const prevSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
      });
      hadPreviousSub = prevSubs.data.length > 0;
    }

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/payment-canceled`,
    };

    // Add 7-day free trial for new subscribers
    if (!hadPreviousSub) {
      sessionParams.subscription_data = {
        trial_period_days: 7,
      };
    }

    // Stable across retries of the same logical request: same user + tier +
    // interval + trial-eligibility resolve to the same key, so a client
    // retry (or an SDK-level network retry) reuses the original session
    // instead of opening a second one.
    const idempotencyKey = `subscription-checkout-${user.id}-${tier}-${interval}-${hadPreviousSub ? "resub" : "trial"}`;

    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
