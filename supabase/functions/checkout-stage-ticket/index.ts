import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = resolveStripeSecretKey();
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user?.email) throw new Error("Not authenticated");

    const { stage_id } = await req.json();
    if (!stage_id) throw new Error("stage_id required");

    const { data: stage } = await admin.from("curated_stages")
      .select("id, title, is_paid, price_cents, currency, status, capacity, rsvp_count")
      .eq("id", stage_id).single();
    if (!stage) throw new Error("Stage not found");
    if (!stage.is_paid) throw new Error("Stage is free — use rsvp-curated-stage");
    if (!["scheduled", "live"].includes(stage.status)) throw new Error("Stage not open");
    if (stage.rsvp_count >= stage.capacity) throw new Error("Stage sold out");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find/create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "https://www.thrivein.io";
    const currency = (stage.currency || "usd").toLowerCase();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [{
        price_data: {
          currency,
          product_data: { name: stage.title || "Sound Stage Ticket" },
          unit_amount: stage.price_cents || 0,
        },
        quantity: 1,
      }],
      success_url: `${origin}/circle/stage/${stage_id}?ticket=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/circle/stage/${stage_id}?ticket=cancel`,
      metadata: { stage_id, user_id: user.id, kind: "curated_stage" },
    }, { idempotencyKey: `stage-ticket-checkout-${stage_id}-${user.id}` });

    // Record pending order
    try {
      await admin.from("curated_stage_orders").insert({
        stage_id,
        user_id: user.id,
        stripe_session_id: session.id,
        amount_cents: stage.price_cents || 0,
        currency,
        status: "pending",
      });
    } catch (_e) { /* best-effort */ }


    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[checkout-stage-ticket]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
