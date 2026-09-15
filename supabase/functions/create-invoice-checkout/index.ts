// Creates a Stripe Checkout session to pay an invoice. Public.
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
    const { invoice_id, payer_email } = await req.json();
    if (!invoice_id) throw new Error("invoice_id required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, invoice_number, issued_by, total_amount, currency, status, document_type, brand_name, recipient_email")
      .eq("id", invoice_id)
      .maybeSingle();
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.document_type === "quote") throw new Error("Quotes can't be paid");
    if (invoice.status === "paid") throw new Error("Invoice already paid");

    const cents = Math.round(Number(invoice.total_amount) * 100);
    if (!cents || cents < 50) throw new Error("Invalid amount");

    const { data: wallet } = await admin
      .from("creator_wallets")
      .select("stripe_account_id, payouts_enabled")
      .eq("user_id", invoice.issued_by)
      .maybeSingle();

    const stripe = new Stripe(resolveStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://www.thrivein.io";

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      customer_email: payer_email || invoice.recipient_email || undefined,
      line_items: [{
        price_data: {
          currency: (invoice.currency || "USD").toLowerCase(),
          product_data: { name: `Invoice ${invoice.invoice_number}`, description: invoice.brand_name || undefined },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/pay/invoice/${invoice_id}?status=success`,
      cancel_url: `${origin}/pay/invoice/${invoice_id}?status=cancelled`,
      metadata: { kind: "invoice", invoice_id, recipient_user_id: invoice.issued_by },
    };
    // payouts_enabled is our own stored flag and can go stale relative to Stripe's
    // live state (e.g. a capability got revoked after we last synced it — see
    // create-payment-link-checkout), so it's necessary but not sufficient — verify
    // the actual capability with Stripe right before deciding to attempt a
    // destination charge.
    if (wallet?.stripe_account_id && wallet?.payouts_enabled) {
      const account = await stripe.accounts.retrieve(wallet.stripe_account_id);
      if (account.capabilities?.transfers !== "active") {
        throw new Error("This creator hasn't finished setting up payouts yet — please try again later.");
      }
      params.payment_intent_data = {
        transfer_data: { destination: wallet.stripe_account_id },
        on_behalf_of: wallet.stripe_account_id,
      };
    } else if (wallet?.stripe_account_id && !wallet?.payouts_enabled) {
      throw new Error("This creator hasn't finished setting up payouts yet — please try again later.");
    }

    // Idempotency key from invoice_id + charge amount: a double-click or
    // network retry of "pay this invoice" reaches Stripe with the same key
    // and gets deduped instead of creating a second Checkout Session. Once
    // the invoice is marked paid, the status guard above stops this line
    // from ever being reached again for it, so no time-window is needed.
    const session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `invoice-checkout:${invoice_id}:${cents}`,
    });
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-invoice-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
