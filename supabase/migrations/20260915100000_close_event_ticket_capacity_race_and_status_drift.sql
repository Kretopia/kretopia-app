-- Fixes two confirmed, still-open bugs found in a manual audit of the
-- native event-ticketing system (creative_jams / event_ticket_tiers /
-- event_orders / jam_participants). Distinct from the already-merged
-- "[SECURITY] Close live free-ticket exploit in legacy event checkout" PR --
-- that fixed a free-ticket price-bypass in the legacy purchase-event-ticket
-- path; this migration does not touch that.
--
-- =============================================================================
-- 1. Check-then-act capacity race (TOCTOU) on event_ticket_tiers.quantity_sold
-- =============================================================================
-- supabase/functions/checkout-event-tickets/index.ts reads
-- event_ticket_tiers.quantity_sold, compares it against quantity_total, and
-- only *afterwards* -- as a separate statement, using the value it already
-- read into application memory -- writes quantity_sold back
-- (`quantity_sold: tier.quantity_sold + quantity`). Two concurrent buyers
-- near the capacity limit can both read the same quantity_sold, both pass
-- the check, and both write `stale + own_qty`: whichever write lands second
-- clobbers the first (a lost update), and/or the tier ends up sold past
-- quantity_total, depending on interleaving -- a classic check-then-act
-- race. supabase/functions/verify-event-ticket/index.ts has the exact same
-- read-then-write shape for paid orders once Stripe confirms payment, and
-- there it doesn't even re-check capacity at all -- it just blindly writes
-- `tier.quantity_sold + order.quantity`.
--
-- Fix: a single SECURITY DEFINER function that locks the tier row
-- (`SELECT ... FOR UPDATE`), re-checks capacity, and writes the new count --
-- all inside one statement/transaction, so no other transaction can read a
-- stale quantity_sold in between. This is the same pattern this codebase
-- already uses for the same class of problem: consume_daily_swipe()
-- (20260910180000_close_ai_usage_counter_bypass.sql) locks profiles with
-- FOR UPDATE before its check-and-increment for exactly this reason.
--
-- Restricted to service_role only (not authenticated, unlike
-- consume_daily_swipe): both call sites are edge functions using the
-- service-role client, and this function trusts its _tier_id/_quantity
-- arguments with no caller-identity check. consume_daily_swipe can safely
-- allow `authenticated` because it also checks `auth.uid() = _user_id`
-- ("this is my own resource") -- there's no equivalent check to make for an
-- arbitrary ticket tier, so the safer choice is to not expose it to
-- authenticated/anon at all.
--
-- How the two call sites use it (deliberately different, see each site's
-- own code comment for the full reasoning):
--   - checkout-event-tickets' free-ticket branch grants access instantly in
--     the same request that runs the capacity check, so the atomic RPC
--     fully closes the race for free tickets: capacity can never be
--     oversold. A refused reservation cancels the (still-pending) order and
--     fails the request with the same "Not enough tickets remaining" error
--     the existing pre-check already used.
--   - The paid-ticket pre-check in checkout-event-tickets (before creating
--     the Stripe session) stays a plain, unlocked read deliberately -- see
--     the code comment there. Real money changes hands on Stripe's side,
--     asynchronously, sometimes minutes later, and holding a Postgres row
--     lock across that round trip would be its own bug. This migration does
--     not add a seat-hold/expiry system (a separate feature with its own
--     product questions -- hold duration, abandoned-checkout cleanup --
--     nobody has asked for). What IS fixed: verify-event-ticket's actual
--     quantity_sold write, once Stripe confirms payment, now goes through
--     the same locked check-and-increment, so concurrent payment
--     confirmations can no longer corrupt the counter via a lost update,
--     and a tier that's already at/over capacity by the time a given
--     payment is confirmed is now *detected and flagged* on the order
--     (metadata.capacity_exceeded = true) instead of silently vanishing
--     into an inaccurate counter. The order is still completed as 'paid'
--     and the buyer is still seated -- they already paid, and this
--     migration deliberately does not invent an automatic refund/denial
--     flow (see part 3 below and the columns it documents).

CREATE OR REPLACE FUNCTION public.reserve_event_ticket_capacity(_tier_id uuid, _quantity integer)
RETURNS TABLE(allowed boolean, quantity_sold integer, quantity_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sold integer;
  v_total integer;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'quantity must be a positive integer';
  END IF;

  SELECT et.quantity_sold, et.quantity_total INTO v_sold, v_total
  FROM public.event_ticket_tiers et
  WHERE et.id = _tier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket tier not found';
  END IF;

  IF v_total IS NOT NULL AND v_sold + _quantity > v_total THEN
    RETURN QUERY SELECT false, v_sold, v_total;
    RETURN;
  END IF;

  UPDATE public.event_ticket_tiers
  SET quantity_sold = v_sold + _quantity
  WHERE id = _tier_id;

  RETURN QUERY SELECT true, v_sold + _quantity, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_event_ticket_capacity(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_event_ticket_capacity(uuid, integer) TO service_role;

-- =============================================================================
-- 2. jam_participants.status drift between the free-RSVP and
--    ticket-purchase code paths
-- =============================================================================
-- jam_participants_status_check (added in 20260903010000) allows
-- ('interested','going','maybe','declined','cancelled') -- the set every
-- free-RSVP code path actually uses: rsvp_to_event() (this migration's
-- neighbor), EventPage.tsx, SessionCard.tsx, SessionDetailDialog.tsx,
-- Onboarding.tsx, and every read-side filter across event-reminders,
-- generate-event-recap, EventCheckInDialog, etc.
--
-- But both ticket-purchase edge functions -- checkout-event-tickets' free-
-- ticket branch and verify-event-ticket's paid-ticket branch -- write
-- status = 'rsvp', a value the constraint has never allowed. Neither
-- function checks the .upsert() error, so this has been failing silently
-- (Postgres 23514, swallowed) on every single native event ticket purchase,
-- free or paid: the payment/RSVP succeeds, the order is marked 'paid', but
-- the buyer is never actually written into jam_participants -- they don't
-- show up on the host's guest list, check-in, attendee count, or "My
-- sessions". (Confirmed independently: SessionsSection.tsx and
-- EventsNearYouSection.tsx already defensively include 'rsvp' in their
-- *read* filters, anticipating a value that, per this constraint, was in
-- fact never actually stored.)
--
-- 'going' is the already-complete, DB-enforced, everywhere-else-used value
-- for "this person has a confirmed spot" -- nothing in this schema
-- distinguishes a ticket holder from a free RSVP via jam_participants.status
-- (that distinction, when needed, comes from joining event_orders), so
-- there's no legitimate value 'rsvp' is carrying that 'going' doesn't
-- already cover. The fix is therefore in the code (both edge functions now
-- write 'going', and the dead 'rsvp' literal is dropped from the two
-- defensive read filters that anticipated it), not in the constraint --
-- unlike credit_claim_disputes (20260817140000_harden_credit_dispute_
-- resolution_rls.sql), where the values the constraint was missing were
-- genuinely, legitimately written by real code and the constraint needed
-- widening. Here the opposite is true: the value on the wrong side of the
-- constraint isn't a legitimate one worth keeping.

-- =============================================================================
-- 3. Refund columns: investigated, confirmed dead, left documented (not built)
-- =============================================================================
-- event_orders.refunded_at, event_orders.refund_amount, and
-- creative_jams.refund_policy are read and written nowhere in the
-- application (confirmed via full-repo grep across src/ and
-- supabase/functions/ -- the only hits are the auto-generated
-- src/integrations/supabase/types.ts). There is no refund UI for events, no
-- partial/full-refund edge function for event orders, and no event-specific
-- refund copy anywhere in the app (Terms.tsx's "5.3 Refunds" section is
-- generic subscription-billing copy, unrelated to event tickets). Nothing
-- in the codebase currently promises buyers a refund flow, so this
-- migration does not build one -- that's a product decision (self-serve vs.
-- host-initiated, partial vs. full, any cancellation-window policy) nobody
-- has made yet, and inventing it here would be scope creep on a
-- capacity/status-consistency fix.
--
-- Documented instead, so this is discoverable rather than silently dead. A
-- real implementation would need, at minimum:
--   - A refund-event-ticket edge function calling stripe.refunds.create
--     against event_orders.stripe_payment_intent_id, then setting
--     status = 'refunded', refunded_at = now(), refund_amount = <amount>
--     (status already allows 'refunded' -- see event_orders_status_check).
--   - Releasing the seat atomically: decrement event_ticket_tiers.
--     quantity_sold back down (mirror of reserve_event_ticket_capacity()
--     above) and update/remove the buyer's jam_participants row.
--   - Host-facing UI (e.g. in EventBackstage.tsx's order list) to trigger a
--     refund, and buyer-facing UI to see refund status.
--   - Surfacing creative_jams.refund_policy somewhere a host can actually
--     set it (no create/edit-event UI currently exposes this field) and
--     somewhere a buyer sees it before paying.
COMMENT ON COLUMN public.event_orders.refunded_at IS
  'UNUSED as of 2026-09: no code path reads or writes this column -- no refund flow exists for event tickets. See 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql part 3 for what a real implementation needs before this can be wired up.';
COMMENT ON COLUMN public.event_orders.refund_amount IS
  'UNUSED as of 2026-09: no code path reads or writes this column -- no refund flow exists for event tickets. See 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql part 3 for what a real implementation needs before this can be wired up.';
COMMENT ON COLUMN public.creative_jams.refund_policy IS
  'UNUSED as of 2026-09: no create/edit-event UI sets this, and no buyer-facing UI reads it -- fully dead. See 20260915100000_close_event_ticket_capacity_race_and_status_drift.sql part 3.';
