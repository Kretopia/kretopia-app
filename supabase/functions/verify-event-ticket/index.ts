import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveStripeSecretKey } from "../_shared/stripeEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: any) =>
  console.log(`[verify-event-ticket] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { sessionId, orderId } = body || {};
    if (!sessionId && !orderId) throw new Error("sessionId or orderId required");

    const { data: order, error: orderErr } = await admin
      .from("event_orders")
      .select("*")
      .eq(sessionId ? "stripe_session_id" : "id", sessionId || orderId)
      .single();
    if (orderErr || !order) throw new Error("Order not found");

    // Already finalized
    if (order.status === "paid") {
      return new Response(JSON.stringify({ status: "paid", orderId: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(resolveStripeSecretKey(), {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Atomic check-and-increment against the tier's capacity (tiered orders
    // only -- legacy untiered orders from purchase-event-ticket have
    // tier_id = null and were never tracked against a tier's capacity).
    // Replaces a bare read-then-write that (a) could silently lose an
    // increment under concurrent payment confirmations for the same tier
    // and (b) never re-checked capacity at all, so a tier could be sold
    // arbitrarily far past quantity_total once enough concurrent buyers got
    // past checkout-event-tickets' pre-check. See
    // reserve_event_ticket_capacity() in
    // 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql.
    let capacityExceeded = false;
    if (order.tier_id) {
      const { data: reservation, error: reserveErr } = await admin
        .rpc("reserve_event_ticket_capacity", { _tier_id: order.tier_id, _quantity: order.quantity })
        .single();
      if (reserveErr) {
        // Stripe already captured payment by this point -- don't fail
        // verification over a counter update. Log loudly; the order still
        // gets marked paid and the buyer still gets seated below.
        log("capacity RPC error (non-fatal, payment already captured)", { orderId: order.id, msg: reserveErr.message });
      } else if (!reservation?.allowed) {
        // Payment already succeeded on Stripe by the time we got here --
        // this codebase has no refund flow for event tickets
        // (event_orders.refunded_at/refund_amount are unused, see their
        // COMMENT ON COLUMN) and this function must not call Stripe to move
        // money, so an already-paid buyer is not denied their seat here.
        // What the atomic check buys us: this is now a *detected, flagged*
        // overbook instead of a silent, uncounted one -- visible on the
        // order (metadata.capacity_exceeded) for manual host/admin
        // follow-up, instead of the counter just quietly drifting.
        capacityExceeded = true;
        log("CAPACITY EXCEEDED at payment confirmation -- seating anyway (already paid)", {
          orderId: order.id, tierId: order.tier_id, quantity: order.quantity,
        });
      }
    }

    // Mark paid + grant access (idempotent)
    await admin.from("event_orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        ...(capacityExceeded ? { metadata: { ...(order.metadata || {}), capacity_exceeded: true } } : {}),
      })
      .eq("id", order.id);

    if (order.promo_code_id) {
      await admin.rpc("increment_promo_use", { _id: order.promo_code_id }).catch(() => {});
    }

    // 'going' matches jam_participants_status_check and every other RSVP
    // code path -- this used to write 'rsvp', a value the constraint has
    // never allowed, so the upsert was silently failing (error not checked)
    // on every paid ticket purchase and the buyer never actually joined the
    // guest list despite having paid.
    await admin.from("jam_participants").upsert({
      jam_id: order.event_id,
      user_id: order.buyer_id,
      status: "going",
    }, { onConflict: "jam_id,user_id" });

    log("verified", { orderId: order.id });

    return new Response(JSON.stringify({ status: "paid", orderId: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
