# Kretopia — Stripe / Payment Edge-Function Security Audit

**Scope**: Static code audit only. Every payment-related Supabase edge function in this repo was read in full. **No Stripe API calls were made, no test/sandbox/live transactions were run, no migrations were touched, and no source files were edited as part of producing this document.** Findings are evidence-based and cited to file path + line number from direct reads on branch `feature/activation-priority-plan`.

**Non-negotiable rule applied throughout**: every payment action must be server-confirmed. The frontend must never be trusted to mark something paid/funded/approved/released/refunded/paid-out. Webhooks must be signature-verified. Amounts/currency/status transitions must be re-derived from the database or Stripe's own API response, never trusted from the client request body. Every payment-affecting operation should be idempotent. Ownership must be verified for the specific action being performed.

**Files audited**: all 31 functions listed in the audit brief, read in full. Three additional functions (`verify-event-ticket`, `verify-stage-ticket`, `join-paid-circle`) were also read in full because they are the actual payment-confirmation/creation counterparts of `checkout-event-tickets`, `checkout-stage-ticket`, and `verify-circle-payment` — auditing those three functions without their counterparts would have produced an incomplete and misleading picture of whether those flows are server-confirmed. They are included below, clearly marked as outside the original list.

---

## Summary table

| Function | Action | Webhook sig verified | Client input trusted | Ownership check | Idempotent | Severity |
|---|---|---|---|---|---|---|
| `auto-resolve-disputes` | Cron: auto-transfer stale credit-dispute ownership | n/a | none | **no** (no cron/admin guard) | yes | minor |
| `batch-milestone-payout` | Batch escrow capture + combined checkout | n/a | none (amount from DB) | yes | partial | minor |
| `capture-milestone-payment` | Capture/cancel escrowed milestone PaymentIntent | n/a | none | yes (via `escrowAuth`) | partial (no pre-check, relies on Stripe error) | minor |
| `checkout-event-tickets` | Create checkout / free-ticket for event | n/a | none (price/discount from DB) | yes | yes | none |
| `checkout-stage-ticket` | Create checkout for paid stage ticket | n/a | none (price from DB) | yes | yes | none |
| `create-checkout` | Subscription checkout | n/a | Stripe `priceId` (catalog-scoped, not amount) | n/a | n/a | minor |
| `create-connect-payment` | Generic Connect-destination checkout | n/a | **amount + recipientAccountId** | **no** | no | major (unreferenced by frontend — see note) — ✅ FIXED (confirmed 2026-09-15): function deleted |
| `create-founder-checkout` | Fixed-price Founder Circle checkout | n/a | none (hardcoded price) | n/a (self) | yes | none |
| `create-invoice-checkout` | Public invoice-payment checkout | n/a | none (amount from DB invoice) | n/a (intentionally public) | partial | minor |
| `create-milestone-payment` | Milestone checkout (escrow or immediate) | n/a | none for amount (fixed this session) | **no** (new finding — see below) | yes | moderate — ✅ FIXED (confirmed 2026-09-15) |
| `create-payment` | Generic wallet top-up checkout (dead code) | n/a | **amount + type** | n/a (self) | no persisted record | minor (dead code, no completion handler) — ✅ FIXED (confirmed 2026-09-15): function deleted |
| `create-payment-link-checkout` | Public payment-link checkout | n/a | amount (bounded by DB min/max for variable links only) | n/a (intentionally public) | yes | minor |
| `get-payment-intent` | Read-only Stripe session lookup | n/a | none | n/a (public by design) | n/a | none |
| `guest-wallet-me` | Read-only guest wallet view | n/a | none | yes (token-scoped) | n/a | none |
| `guest-wallet-session` | Guest wallet OTP session mint | n/a | none | yes (email-verified) | yes | none |
| `guest-wallet-topup` | Create checkout for guest wallet top-up | n/a | amount (bounded $1–$1000) | yes (token-scoped) | yes | none |
| `guest-wallet-webhook` | Webhook: credit guest wallet | **yes** | none | n/a | yes | none |
| `invoice-pay-info` | Public read of payable invoice | n/a | none | n/a (public by design) | n/a | none |
| `payment-link-info` | Public read of a payment link | n/a | none | n/a (public by design) | n/a | none |
| `release-escrow` | Buyer confirm/dispute of marketplace escrow | n/a | none (amount from DB order) | yes | yes | none |
| `send-invoice-chase` | Drafts/sends payment-chase email | n/a | none | yes | n/a | none (not a money-mover) |
| `stripe-marketplace-webhook` | Webhook: invoice/payment-link/milestone/marketplace order | **yes** | none | n/a | partial (see findings) | minor — ✅ FIXED (confirmed 2026-09-15): event-ID dedup added |
| `stripe-wallet-webhook` | Webhook: Connect account + payout status sync | **yes** | none | n/a | yes | none |
| `thrivefund-release-milestone` | Creator releases campaign milestone tranche | n/a | milestoneIndex (bounds-checked) | yes | **no** | **critical** — ✅ FIXED (confirmed 2026-09-15) |
| `verify-circle-payment` | "Confirms" paid Circle subscription | n/a | status (implicitly, via no check at all) | yes (self only) | n/a | **critical** — ✅ FIXED (confirmed 2026-09-15) |
| `verify-founder-payment` | Confirms founder checkout, grants tier+XP | n/a | none for amount | **partial** (no session-owner check) | yes | moderate — ✅ FIXED (confirmed 2026-09-15) |
| `wallet-add-bank` | Provision Connect account + bank account | n/a | bank details (expected) | yes | n/a | none |
| `wallet-balance` | Read-only Connect balance | n/a | none | yes | n/a | none |
| `wallet-payout` | Creator payout from own Connect balance | n/a | amount_cents (own balance, Stripe-enforced) | yes | no idempotency key | minor |
| `wallet-topup` | Create checkout for internal wallet top-up | n/a | amount (bounded ≤ $10,000) | yes | yes | none |
| `wallet-topup-confirm` | Confirms Stripe payment, credits wallet | n/a | none (Stripe-verified) | yes | yes | none |
| `wallet-transfer` | Peer-to-peer internal wallet transfer | n/a | amount (debited from own real balance) | yes | no request-level idempotency key | minor |
| *(extra)* `verify-event-ticket` | Confirms event ticket checkout | n/a | none (Stripe-verified) | n/a (session/order-id gated) | yes | none |
| *(extra)* `verify-stage-ticket` | Confirms stage ticket checkout | n/a | none (Stripe-verified) | yes (buyer-id match) | yes | none |
| *(extra)* `join-paid-circle` | Creates paid-circle checkout | n/a | none (price from DB) | yes | n/a | none |

---

## Critical findings (detail)

### `verify-circle-payment` — grants paid Circle membership with **zero Stripe verification**

> **✅ FIXED (confirmed 2026-09-15)** — see `supabase/functions/verify-circle-payment/index.ts:48-66`. The function now instantiates a real Stripe client, calls `stripe.checkout.sessions.retrieve(sessionId)`, and requires `session.payment_status === "paid"`, `session.metadata?.type === "circle_subscription"`, `session.metadata?.circle_id === circleId`, and `session.metadata?.buyer_id === user.id` before touching `circle_subscriptions`. Confirmed by direct read of current source, not assumed from the commit message.

`supabase/functions/verify-circle-payment/index.ts:1-87`

1. **Action**: activates a `circle_subscriptions` row (`pending`→`active`, 30-day expiry) and adds the caller to `spark_room_members` — this is the function that is supposed to confirm a paid Circle membership actually got paid for.
2. **Webhook signature**: n/a — this is a client-invoked function, not a webhook.
3. **Client input trusted**: the entire payment outcome. There is **no `Stripe` import anywhere in the file**. The `sessionId` parameter (line 35) is accepted from the request body and is only ever written into `stripe_subscription_id: sessionId || null` (line 52) — it is never passed to `stripe.checkout.sessions.retrieve()`, never checked for a `paid` status, never validated as a real Stripe object at all.
4. **Ownership check**: the update is scoped to `.eq('circle_id', circleId).eq('user_id', user.id).eq('status', 'pending')` (lines 46-56) — so a caller can only activate *their own* pending row, not someone else's. This limits the blast radius to "free access for yourself," not "grant access to others."
5. **Idempotency**: irrelevant given the underlying bug — the function will happily flip status to active on any call with a matching pending row.
6. **Refund/cancellation discipline**: n/a — not a refund flow — but this is the exact anti-pattern the audit's non-negotiable rule exists to catch: the DB is updated on a bare client claim, not on Stripe confirmation.

**Exploit path, fully traced**:
- `supabase/functions/join-paid-circle/index.ts:178-187` creates a `circle_subscriptions` row with `status: 'pending'` **before any payment occurs** (this is normal/correct — it happens at checkout-session-creation time, same as every other flow in this codebase).
- The frontend (`src/components/scene/CirclesTab.tsx:253-277`) calls `verify-circle-payment` automatically whenever the URL contains `?joined=<circleId>&session_id=<anything>` — which is also directly callable via `supabase.functions.invoke('verify-circle-payment', { body: { circleId, sessionId: 'anything' } })` from the browser console with no Stripe interaction at all.
- Result: **any authenticated user can join any paid Circle for free**, with no payment, by calling `join-paid-circle` then immediately `verify-circle-payment`.

**Severity: CRITICAL.** This is the single clearest violation of "the frontend must never be trusted to mark something paid" found in this audit. It is also an isolated bug, not a systemic pattern — the four structurally similar "confirm my checkout" functions in this codebase (`verify-founder-payment`, `wallet-topup-confirm`, `verify-event-ticket`, `verify-stage-ticket`) all correctly call `stripe.checkout.sessions.retrieve()` and check `payment_status === 'paid'` before touching the database. `verify-circle-payment` is the one exception.

### `thrivefund-release-milestone` — no idempotency guard on real Stripe transfers

> **✅ FIXED (confirmed 2026-09-15)** — see `supabase/functions/thrivefund-release-milestone/index.ts:86-149`. The function now inserts a reservation row into `public.thrivefund_milestone_releases` (composite-key primary key on `campaign_id`/`milestone_index`, backed by migration `20260818120000_thrivefund_milestone_release_idempotency.sql`) *before* calling Stripe, rejecting a duplicate with a 409 if the insert hits a `23505` unique violation, and additionally passes a deterministic `idempotencyKey: thrivefund_milestone_${campaignId}_${milestoneIndex}` to `stripe.transfers.create()` as defense-in-depth. Confirmed by direct read of current source.

`supabase/functions/thrivefund-release-milestone/index.ts:20-107`

1. **Action**: creates a real `stripe.transfers.create()` (line 77) moving a percentage tranche of a crowdfunding campaign's raised total to the creator's Stripe Connect account.
2. **Webhook signature**: n/a.
3. **Client input trusted**: `milestoneIndex` is client-supplied but is only used as an array index into `campaign.milestone_split`, a DB-sourced array, and is range/percentage validated (lines 56-60) — the tranche amount itself (`trancheCents`, line 74) is computed from `campaign.total_raised` (DB) × `pct` (DB), not from any client-supplied amount. This part is correctly server-derived.
4. **Ownership check**: correct — `campaign.creator_id !== user.id` throws (line 51).
5. **Idempotency**: **there is none.** The function reads `campaign.total_raised` and `milestone_split[milestoneIndex]`, calls `stripe.transfers.create()`, and returns — it never writes anything back to the database (no "released" flag, no per-milestone-tranche record, no check for a prior transfer with matching metadata). Nothing stops the same authorized creator (or a retried/replayed request, or a double-click, or a client bug) from calling this endpoint N times for the same `campaignId` + `milestoneIndex` and receiving N real Stripe transfers of the same tranche amount.
6. **Refund/state discipline**: n/a to this function, but note the sibling `thrivefund-finalize-campaign/index.ts` (not in the original audit list, skimmed for contrast) already uses `idempotencyKey` values for its outbound work (`thrivefund-finalize-campaign/index.ts:146,177`, for its result emails) — proving the team knows the idempotency-key pattern and simply didn't apply it to the money-moving call in this function.

**Severity: CRITICAL / major.** This is a direct, repeatable real-money-loss vector: the platform's own Stripe balance can be drained by repeated calls to a single legitimate, authorized endpoint, with no rate limit, no double-submit protection, and no persisted state to detect the replay. Unlike `verify-circle-payment` (which lets someone get something for free), this lets an authorized actor extract real funds multiple times for one entitlement.

---

## Moderate / notable findings (detail)

### `create-milestone-payment` — missing ownership check (new finding, distinct from the already-fixed amount-trust issue)

> **✅ FIXED (confirmed 2026-09-15)** — see `supabase/functions/create-milestone-payment/index.ts:85-97`. The function now looks up the milestone's project (`client_user_id`, `created_by`) and rejects with a 403 (`"You are not authorized to pay this milestone."`) unless the caller is one of those two. Confirmed by direct read of current source.

`supabase/functions/create-milestone-payment/index.ts:30-284`

The prior session's fix (using the milestone's own DB `amount` column, and the `milestone.status === 'paid'` 409 guard) is present and correct — confirmed at lines 74-104 and 91-97.

However, **nothing in this function checks that the calling user is the project's client/owner** before it builds a Stripe Checkout session for an arbitrary `milestoneId`. Compare with `batch-milestone-payout/index.ts:48-58` and `thrivefund-release-milestone/index.ts:51`, both of which have an explicit authorization check for the equivalent action — this function has none.

**Why this matters given `_shared/escrowAuth.ts`**: when `useEscrow` is true, the session's `payment_intent_data.metadata` is set to `{ ..., userId: user.id, ... }` (line 248). `escrowAuth.ts:30-33`'s `payerFromMetadata()` reads exactly this key (`metadata.userId`). Because nothing verifies the caller has any relationship to the project before this metadata is set, **any authenticated user can call this endpoint on someone else's milestone, actually pay it with their own card, and thereby become the sole party `assertCanReleaseMilestone` (`_shared/escrowAuth.ts:39-65`) will recognize as authorized to release or cancel that escrow** — locking the real project client out of their own milestone (the fallback to `project.client_user_id`/`created_by` only triggers when *no* payer metadata exists at all). For the non-escrow "Pay Now" path, the same gap lets an unrelated party pay off someone else's milestone and become the invoice's `issued_by` (see `stripe-marketplace-webhook/index.ts:208,256,275` — `payerUserId` comes straight from this same unchecked `session.metadata.userId`), producing an invoice that misattributes who the paying "brand" actually was.

**Severity: moderate.** Exploiting this requires the attacker to spend real money (this is not a free-money bug), but it is a genuine authorization gap with a concrete griefing/lock-out consequence for escrow, and a data-integrity consequence (misattributed payer) for immediate-pay milestones.

### `verify-founder-payment` — no check that the Stripe session belongs to the caller

> **✅ FIXED (confirmed 2026-09-15)** — see `supabase/functions/verify-founder-payment/index.ts:69-71`. After retrieving the session and confirming `payment_status === 'paid'` and `metadata?.type === 'founder_circle'`, the function now also requires `session.metadata?.user_id === user.id`, throwing "Session does not belong to this user" otherwise. Confirmed by direct read of current source.

`supabase/functions/verify-founder-payment/index.ts:33-134`

Correctly retrieves the Stripe session and requires `payment_status === 'paid'` (lines 51-56) and `metadata?.type === 'founder_circle'` (lines 59-61) — this is the right pattern, unlike `verify-circle-payment`. But it never checks `session.metadata?.user_id === user.id` before granting the *calling* user founder tier + 5,000 XP (lines 88-119). The Stripe `sessionId` is exposed in the redirect URL set by `create-founder-checkout/index.ts:87` (`/payment-success?session_id={CHECKOUT_SESSION_ID}&type=founder`), so anyone who obtains another user's real, paid session ID (browser history, a shared link/screenshot, referrer leakage to third-party scripts on the success page, server/CDN logs) could call this function themselves and be granted founder status on someone else's payment. Idempotency is handled correctly (`existing.status === 'completed'` short-circuit, lines 64-76), so this can't be used to double-claim, only to misdirect a single claim to the wrong account.

**Severity: moderate** — real gap, but requires a session-ID leak, not just knowledge of a circle/milestone ID.

### `create-connect-payment` — fully client-controlled amount and payout destination

> **✅ FIXED (confirmed 2026-09-15)** — `supabase/functions/create-connect-payment/` **no longer exists in this repo**. Confirmed via `ls supabase/functions/` (directory absent) and `git show --stat eae5f217` (commit `eae5f217`, 2026-08-23, "fix(krepay): close two critical wallet RLS holes, harden webhook + payouts") shows `supabase/functions/create-connect-payment/index.ts | 160 ----------------`, i.e. the file was deleted outright, matching the precedent set for `create-escrow-payment`. Per that commit's own message: "deleting the source does not by itself undeploy an already-live function" — actual deployment status was not re-confirmed this pass (no Supabase CLI/dashboard access), so treat the *capability* as closed at the source level, with live-deployment status still unconfirmed.

`supabase/functions/create-connect-payment/index.ts:52-134`

`amount` and `recipientAccountId` are destructured directly from the request body (lines 52-58) and used, unvalidated against any database record, to set the Stripe Checkout line-item price (line 103) and the `transfer_data.destination` (line 112) — i.e., the caller fully controls both what will be charged and which Stripe Connect account receives it. `projectId`/`milestoneId` are accepted but never used to look up a canonical amount or verify a real relationship. This is the same class of bug as the dead-code `create-escrow-payment` function already removed from this repo per `SECURITY_RELEASE_GATE.md` M1.

Confirmed via repo-wide grep that **no frontend code calls this function** (`grep -rn "create-connect-payment" src/` returns zero hits) — it is unreferenced, effectively dead code that remains deployed. Because the payer must still complete a real Stripe Checkout with their own card, this cannot be used to *steal* existing funds from another party — but it could be used to construct an arbitrary "pay X to Stripe-Connect-account Y" checkout completely divorced from any project/milestone/fee logic, bypassing the platform's normal fee-attribution and audit trail if ever wired up or called directly against the deployed function URL.

**Severity: major** (as a deployed capability), heavily mitigated by being unreferenced anywhere in `src/`.

### `create-payment` — fully client-controlled amount/type, no completion handler, dead code

> **✅ FIXED (confirmed 2026-09-15)** — `supabase/functions/create-payment/` **no longer exists in this repo**. Same commit as `create-connect-payment` above (`eae5f217`, 2026-08-23) deleted it outright (`supabase/functions/create-payment/index.ts | 78 --------`). Confirmed via `ls supabase/functions/` and `git show --stat eae5f217`.

`supabase/functions/create-payment/index.ts:27-65`

`amount` and `type` come straight from the request body and set the Checkout unit_amount (lines 27, 52). This is internally self-consistent (the amount charged and the amount that would be credited are the same client-supplied number, so there's no over-credit vector even if wired up) but confirmed via grep to have **no frontend caller** and **no webhook/confirm handler anywhere in the codebase** recognizes this checkout's metadata (`type: 'wallet_topup'` string literal doesn't match any `kind`/`type` branch in `stripe-marketplace-webhook`). It appears fully superseded by the properly-built `wallet-topup` + `wallet-topup-confirm` pair.

**Severity: minor** — dead code with no exploitable fund-theft path, but its very presence (deployed, callable, no completion handler) is worth cleaning up.

---

## Minor findings (detail)

### `stripe-marketplace-webhook` — inconsistent idempotency guards across its four branches

> **✅ FIXED (confirmed 2026-09-15)** — see `supabase/functions/stripe-marketplace-webhook/index.ts:63-78`. The webhook now inserts into `stripe_webhook_events` (`event_id`, `type`, `payload`) immediately after signature verification and before any branch logic runs, returning `{ received: true, idempotent_event: true }` on a `23505` duplicate — the same event-ID-level dedup pattern already used by `guest-wallet-webhook`/`stripe-wallet-webhook`, closing the `payment_links.use_count` double-increment risk this finding described. Confirmed by direct read of current source.

`supabase/functions/stripe-marketplace-webhook/index.ts`

- The **milestone** branch has an explicit, well-commented idempotency guard (`milestone.status === 'paid'`, lines 185-190) that the code itself documents as covering both webhook redelivery and same-milestone race conditions.
- The **marketplace-order** branch checks for an existing order by both `checkout_session_id` (lines 350-361) and `payment_intent_id` (lines 364-375) before inserting — good, dual-keyed idempotency.
- The **invoice** branch (lines 66-95) and **payment-link** branch (lines 98-148) have **no pre-check of current status** before writing. Setting `invoices.status = 'paid'` twice is a harmless no-op, but the payment-link branch's `use_count` increment (lines 111-129) is a plain read-then-increment with no guard — if Stripe redelivers the same `checkout.session.completed` event (which Stripe's own docs say can happen and which this codebase's sibling webhooks defend against), `use_count` would increment twice for one real payment, which could prematurely disable a `max_uses`-limited or `single_use` payment link.
- Unlike `guest-wallet-webhook` (`supabase/functions/guest-wallet-webhook/index.ts:71-81`) and `stripe-wallet-webhook` (`supabase/functions/stripe-wallet-webhook/index.ts:39-44`), this webhook **does not write to the `stripe_webhook_events` table at all** — there is no event-ID-level dedup guard anywhere in the file, only the per-row guards described above.

**Severity: minor** — no direct money-loss path, but a real correctness gap on webhook redelivery, and an inconsistency with the dedup pattern already used correctly by this codebase's two other Stripe webhook handlers.

### `capture-milestone-payment` — no explicit pre-capture status check

`supabase/functions/capture-milestone-payment/index.ts:73-87`

Relies on Stripe's own API to reject a second `.capture()`/`.cancel()` call, caught by a generic error handler that returns a 500. Money cannot actually move twice (Stripe enforces this), but the failure mode is an ungraceful error rather than a clean idempotent response, unlike `create-milestone-payment`'s explicit `status === 'paid'` 409 guard in the same function family. (This matches a previously-documented finding in this repo's own `SECURITY_RELEASE_GATE.md`, M2 — restated here because it was in scope for this pass.)

### `batch-milestone-payout` — combined-checkout path has no completion handler

`supabase/functions/batch-milestone-payout/index.ts:116-169`

The escrow-capture path (lines 90-114) is sound. The non-escrow "payable" path creates one combined Stripe Checkout session for multiple milestones with metadata `{ batch: 'true', projectId, milestoneIds, userId }` (lines 143-148) — but grep confirms **no function in this codebase reads `session.metadata.batch`** to mark those milestones paid afterward. This is a functional/reliability gap, not a security hole (payment can be taken without ever being reflected in the DB, which under-executes rather than over-executes) — flagged because it means this specific payout path is effectively non-functional end-to-end as written.

### `wallet-payout` and `wallet-transfer` — no idempotency key on the outbound Stripe call

`supabase/functions/wallet-payout/index.ts:46-52`, `supabase/functions/wallet-transfer/index.ts:77-92`

Both correctly scope the action to the authenticated user and use Stripe/atomic-RPC balance enforcement so the *amount* can't be manipulated — but neither passes a Stripe idempotency key, and `wallet-transfer` has no request-level dedup marker either. A client retry (double-click, timeout-triggered resend) could produce two real payouts or two real transfers. `wallet-transfer`'s underlying atomic `wallet_debit`/`wallet_credit` RPCs prevent a *concurrent-race* double-spend on a single call, which is a different problem than a *sequential retry* creating two legitimate-looking calls.

Note on `wallet-transfer`'s actual trust boundary: this function's security depends on `wallets.balance` being trustworthy, which in turn depends on it only ever being written via `wallet_debit`/`wallet_credit`. This repo's own `SECURITY_RELEASE_GATE.md` (finding C4, `supabase/migrations/20250930110718_317c2f4c...sql:36-38`) documents that `wallets.balance` currently also has a direct owner-UPDATE RLS policy with no column restriction — meaning a fabricated balance could, per that existing finding, be spent via this otherwise-correct function. That is an RLS/migration-layer issue outside this audit's scope to re-verify (edge functions only), not a new finding, but it directly affects whether "amount validated against the DB" is actually meaningful for this function, so it's cross-referenced here for completeness.

### `auto-resolve-disputes` — no cron/admin authorization guard

`supabase/functions/auto-resolve-disputes/index.ts:13-75`

Unlike the 9+ functions in this codebase that use `_shared/admin-guard.ts`'s `requireAdminOrCron()` pattern, this function has zero auth check — anyone can invoke it. Impact is limited because its query (`status = 'pending' AND owner_responded_at IS NULL AND auto_resolve_at <= now()`, lines 23-29) only ever touches disputes that are already objectively past their deadline, so an early/unauthorized call can't change *which* disputes resolve or *how* — only *when*, within the window the deadline already permits. Not a Stripe/money function, but included per the audit's file list since it moves `credits` ownership. Flagged for defense-in-depth, not because a concrete exploit path was found.

### `create-checkout` — subscription `priceId` not validated against an allow-list

`supabase/functions/create-checkout/index.ts:27-71`

`priceId` is client-supplied and passed straight to `stripe.checkout.sessions.create`. Because Stripe Price IDs are scoped to this platform's own Stripe account, a caller cannot fabricate an arbitrary amount this way — at most they could select a different real price object than the UI intended them to. No explicit server-side allow-list of expected subscription price IDs exists. Low-severity, informational.

### `create-payment-link-checkout` — variable-price links use a read-then-clamp pattern; webhook use_count race (see stripe-marketplace-webhook above)

`supabase/functions/create-payment-link-checkout/index.ts:32-42` correctly clamps caller-chosen amounts to `link.min_amount_cents`/`max_amount_cents` from the DB for "pay what you want" links, and uses the DB's fixed `amount_cents` outright for fixed-price links — this is the accepted pattern for donation-style links. The only related gap is the webhook-side `use_count` race documented above.

### `create-invoice-checkout` — no idempotency check at the checkout-creation step for concurrent sessions

`supabase/functions/create-invoice-checkout/index.ts:23-33` blocks creating a new checkout if `invoice.status === 'paid'` already, but nothing stops two concurrent requests (two browser tabs) from both passing that check and creating two live Stripe sessions for the same unpaid invoice before either completes. True idempotency is enforced downstream by the webhook's blind status overwrite (harmless no-op for a second `paid` write) — low severity, noted for completeness.

---

## Confirmed-correct patterns (no action needed)

These are the model examples in this codebase — cited so the gaps above can be read in contrast, not in isolation:

- **`wallet-topup-confirm`** (`supabase/functions/wallet-topup-confirm/index.ts:60-99`): retrieves the Stripe session and requires `payment_status === 'paid'` *before* touching the database; uses a conditional `.neq("status","completed")` update to atomically claim the row (only one concurrent request can win) plus an atomic `wallet_credit` RPC — no read-then-write race anywhere.
- **`guest-wallet-webhook`** (`supabase/functions/guest-wallet-webhook/index.ts`): real signature verification (`constructEventAsync`, 400 on failure, lines 24-35); dual idempotency guard — a unique `stripe_webhook_events.event_id` insert (lines 71-81) *and* a conditional `status = 'pending'` update before crediting (lines 109-114).
- **`stripe-wallet-webhook`**: real signature verification; all state (`payouts_enabled`, `kyc_status`, payout status) is written straight from Stripe's own webhook payload, never from client input; event-ID dedup via `stripe_webhook_events`.
- **`release-escrow`**: ownership-checked (`order.buyer_id !== user.id`), Stripe capture happens before the DB is updated, and the order's `status !== "escrow"` guard makes a second `confirm` call a clean no-op.
- **`verify-event-ticket`** / **`verify-stage-ticket`**: both retrieve the Stripe session and gate on `payment_status === 'paid'` before writing; `verify-stage-ticket` additionally checks `session.metadata.user_id === caller` — this is the check `verify-founder-payment` is missing.
- **`capture-milestone-payment`** + **`_shared/escrowAuth.ts`**: `assertCanReleaseMilestone` correctly derives the authorized releaser from the PaymentIntent's own metadata (set at creation time, not re-suppliable at capture time) or falls back to the project's real client/owner, and `loadMilestoneForIntent` binds a specific milestone to a specific payment intent so a caller can't redirect the authorization check to an unrelated milestone.
- **`wallet-add-bank`**: correctly re-derives `payouts_enabled`/`kyc_status` from Stripe's own `accounts.retrieve()` response after attaching a bank account, rather than trusting any client-asserted status.

---

## Notes on prior-session context (per audit brief)

- **`krePayAdvanced` feature flag**: confirmed unchanged — `src/config/kretopiaV1.ts:30` still declares `{ on: false, nav: false, contextual: true }`, and `grep -rn "isV1('krePayAdvanced'"` across `src/` returns zero call sites. The flag gates nothing today; `MilestoneBoard.tsx`'s full escrow create/capture/cancel/batch-payout UI remains unconditionally live regardless of this flag's value. No change from the prior audit's H2 finding.
- **`invoices.status = 'paid'` self-attestation**: still true, but the mechanism changed. `src/components/project/studio/MoneySection.tsx:75-80` (and the other three call sites noted in the prior audit) now call the RPC `confirm_invoice_paid_manually` instead of writing the `invoices` table directly. That RPC (`supabase/migrations/20260812071205_c57b2c1c...sql:490-524`) is `SECURITY DEFINER`, requires the caller to be `auth.uid() = invoice.issued_by` (line 511-513, still self-attestation — no counterparty/payer confirmation), rejects if already paid (line 514-516, an idempotency improvement), and requires a non-empty payment-method note (line 505-507). **Net effect**: the RPC closed the earlier arbitrary-column-tampering vector and added an idempotency guard, but the core trust question — the invoice issuer can still unilaterally mark their own invoice paid with no payer/admin confirmation — is unchanged by design. This is a distinct, intentional "record an offline/manual payment" feature, structurally separate from the Stripe-verified `create-invoice-checkout` → `stripe-marketplace-webhook` path, which remains fully server-confirmed.

---

## Cross-cutting findings

**This is the most important section of this document.** Two functions let the frontend/client cause a payment-adjacent state to change, or real money to move, without a valid server-side check:

1. **`verify-circle-payment` (CRITICAL)** — the frontend can flip a Circle subscription from `pending` to `active` (paid membership + room access) with **zero interaction with Stripe whatsoever**. This is not a missing edge case in an otherwise-correct check; the Stripe verification step is entirely absent from the function. Any authenticated user can obtain any paid Circle's membership for free today, in production, with two edge function calls and no payment. **This should be treated as the top-priority fix from this entire audit.**

2. **`thrivefund-release-milestone` (CRITICAL)** — while this one requires the caller to already be the legitimate campaign creator (ownership is checked correctly), there is no idempotency protection at all on the real `stripe.transfers.create()` call. A replayed, retried, or repeated request drains additional real funds from the platform's Stripe balance to the same creator for the same milestone tranche, with no record ever written to detect or prevent the repeat. This is a real-money-loss bug distinct in kind from #1 (authorization is fine here; idempotency is the failure).

Two further findings are worth elevating even though they don't meet the bar of the two above, because they involve real Stripe checkout sessions with **no server-side ownership binding**:

3. **`create-milestone-payment`** has no check that the caller is the project's client before creating a milestone checkout session — combined with `_shared/escrowAuth.ts` trusting whoever's identity is in the PaymentIntent metadata at capture time, this lets an unrelated, real-money-paying user become the sole party authorized to ever release or cancel that specific escrow, locking out the legitimate client.

4. **`verify-founder-payment`** doesn't check that the Stripe checkout session it's confirming actually belongs to the calling user, relying only on the session ID's presence in a redirect URL as a secrecy boundary.

Everything else — every function that actually moves money based on a Stripe webhook or a server-verified Stripe session (`wallet-topup-confirm`, `guest-wallet-webhook`, `stripe-wallet-webhook`, `stripe-marketplace-webhook`'s milestone/order branches, `release-escrow`, `capture-milestone-payment`, `verify-event-ticket`, `verify-stage-ticket`) — correctly re-derives amount, status, and (where applicable) ownership from the database or from Stripe's own API/webhook payload, and does not trust a bare client assertion that a payment succeeded. The two dead-code functions (`create-connect-payment`, `create-payment`) trust client-supplied amounts/recipients outright but are not reachable through any code path in `src/` today — they should be treated as live risk only if something starts calling them.
