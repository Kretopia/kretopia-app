// Creates a Stripe Checkout session for a payment link. Public — no auth required.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { slug, amount_cents, payer_email, payer_name, payer_note } = await req.json();
    if (!slug) throw new Error("slug required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link } = await admin
      .from("payment_links")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (!link || !link.active) throw new Error("Link not found or inactive");
    if (link.single_use && link.use_count >= 1) throw new Error("Link already used");
    if (link.max_uses && link.use_count >= link.max_uses) throw new Error("Link used up");

    // Resolve amount
    let cents = link.amount_cents ?? 0;
    if (link.mode !== "fixed") {
      const requested = Number(amount_cents);
      if (!requested || requested <= 0) throw new Error("Amount required");
      const min = link.min_amount_cents ?? 100;
      const max = link.max_amount_cents ?? 100_000_00;
      if (requested < min) throw new Error(`Minimum is ${(min / 100).toFixed(2)} ${link.currency}`);
      if (requested > max) throw new Error(`Maximum is ${(max / 100).toFixed(2)} ${link.currency}`);
      cents = Math.round(requested);
    }
    if (!cents || cents < 50) throw new Error("Invalid amount");

    // Recipient's Connect account (frictionless payouts via ThriveIN Wallet)
    const { data: wallet } = await admin
      .from("creator_wallets")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", link.user_id)
      .maybeSingle();

    const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const origin = req.headers.get("origin") || "https://www.thrivein.io";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: payer_email || undefined,
      line_items: [{
        price_data: {
          currency: (link.currency || "USD").toLowerCase(),
          product_data: {
            name: link.title || "Payment",
            description: link.description || undefined,
          },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/pay/${slug}?status=success`,
      cancel_url: `${origin}/pay/${slug}?status=cancelled`,
      metadata: {
        kind: "payment_link",
        payment_link_id: link.id,
        recipient_user_id: link.user_id,
        payer_name: payer_name || "",
        payer_note: payer_note || "",
      },
    };

    // Route funds to recipient's Connect account when available (destination charge).
    // A stripe_account_id alone only means Connect onboarding was started — Stripe
    // doesn't grant the `transfers` capability a destination charge requires until
    // the account is fully verified (payouts_enabled). Using transfer_data against
    // an account that isn't there yet fails at Stripe with a capability error the
    // payer sees mid-checkout; check readiness first and fail clearly instead.
    //
    // payouts_enabled is our own stored flag and can go stale relative to Stripe's
    // live state (e.g. a capability got revoked after we last synced it), so it's
    // necessary but not sufficient — verify the actual capability with Stripe right
    // before deciding to attempt a destination charge.
    if (wallet?.stripe_account_id && wallet?.payouts_enabled) {
      const account = await stripe.accounts.retrieve(wallet.stripe_account_id);
      if (account.capabilities?.transfers !== "active") {
        throw new Error("This creator hasn't finished setting up payouts yet — please try again later.");
      }
      // 5% platform fee for free tier; settled by webhook later if needed
      sessionParams.payment_intent_data = {
        transfer_data: { destination: wallet.stripe_account_id },
        on_behalf_of: wallet.stripe_account_id,
      };
    } else if (wallet?.stripe_account_id && !wallet?.payouts_enabled) {
      throw new Error("This creator hasn't finished setting up payouts yet — please try again later.");
    }

    // No pre-existing order row to key off (it's inserted after the session
    // is created below), so the key is built from the stable inputs that
    // identify "the same attempt": which link, how much, and who's paying.
    const idempotencyKey = `payment-link-checkout-${link.id}-${cents}-${payer_email || "anon"}`;
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });

    // Log a pending payment row (webhook flips it to paid)
    await admin.from("payment_link_payments").insert({
      payment_link_id: link.id,
      user_id: link.user_id,
      amount_cents: cents,
      currency: link.currency,
      payer_email: payer_email || null,
      payer_name: payer_name || null,
      payer_note: payer_note || null,
      stripe_session_id: session.id,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-payment-link-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
