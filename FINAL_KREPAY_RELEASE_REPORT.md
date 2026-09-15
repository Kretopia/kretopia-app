# Final Release Report — Hire Loop, Kreto Chat, KrePay

Branch: `feature/activation-priority-plan` (not pushed to `main`, not
deployed). Session date: 2026-08-23.

## 1. Hire workflow root cause

A March 2026 RLS security fix on `public.notifications` correctly
restricted `INSERT` to `auth.uid() = user_id OR admin`, closing a real
spoofing hole — but the accept-applicant flow (and, in reverse, the
apply-notifies-recruiter flow) still performed a direct client-side insert
on behalf of a *different* user. That insert has been silently rejected
by RLS ever since: the error was only `console.error`'d, the wrapper
function still returned `success: true`, and the recruiter's UI showed a
normal "Application accepted!" toast while the applicant got nothing.
Full trace: `HIRE_LOOP_AUDIT.md`.

## 2. Studio notification fix

Three `SECURITY DEFINER` RPCs, mirroring the existing `vouch_on_credit`
pattern (each validates the caller's real relationship to the target user
itself, rather than trusting a client-side insert):

- `accept_application(_application_id)` — atomically transitions
  `applications.status`, creates the Studio (`projects` row), grants
  access via `project_collaborators`, and writes the applicant's
  notification, all in one transaction.
- `notify_application_status(_application_id, _status)` — shortlist/
  reject notifications.
- `notify_new_application(_application_id)` — the reverse-direction fix.

## 3. Notification idempotency result

`accept_application` is idempotent via a new `projects.source_application_id`
unique partial index — a retried/duplicated accept call returns the
existing Studio instead of creating a second one. All three RPCs write to
`notifications.dedupe_key` (new unique partial index), so a retry never
double-notifies. **Not empirically tested against a live database** — no
DB access this session; see §16.

## 4. Chat overlap root cause and fix

`KretoLauncher`, a global `position: fixed` bottom-right widget, turns on
at exactly the desktop breakpoint (`lg:`) where `Messages.tsx` and
`GroupChatPanel.tsx` stripped their mobile bottom-nav clearance to zero
(`lg:pb-0`) — landing the composer's send button inside Kreto's 56×56px
hit box. Fixed by reserving the same clearance on desktop that already
existed on mobile (`lg:pb-24`). **Live-verified**: measured zero overlap
at 1024/1280/1440px (real ~36px overlap before the fix). Full detail:
`KRETO_CHAT_LAYOUT_REPORT.md`.

## 5. KrePay current status

Not "operational" in the sense of a completed live payment — see §6.
What is true: the canonical payment surfaces (`/thrivepay`, milestone
escrow in a project's Desk) were already live and mostly correctly built
before this session (server-side amount derivation, signature-verified
webhooks, ownership checks — confirmed by direct code read, not assumed).
This session found and fixed real gaps rather than building payments from
scratch. Full inventory: `KREPAY_PAYMENT_AUDIT.md`.

## 6. Stripe test-mode verification

**Not verified as test mode — confirmed live mode.** No code path can
prove key mode either way (`STRIPE_SECRET_KEY` is always read from env,
never hardcoded — confirmed clean). This repo already contains a dated
record of the user confirming live mode directly (`EMAIL_STRIPE_SANDBOX_QA.md`,
2026-08-18). Per the task's own rule, this stopped all Stripe sandbox
testing and payment E2E testing before it started. Detail:
`KREPAY_STRIPE_SANDBOX_REPORT.md`.

## 7. Payment state-machine result

Traced, not modified beyond the specific fixes in §9-10. `milestones.status`/
`invoices.status` were already correctly locked down in a prior session
(column-level `REVOKE` + `SECURITY DEFINER` RPC, confirmed still in force
by direct read). `transactions.status` (pending/completed/failed/cancelled)
now has a real UI surface (`PaymentStatusTimeline`) rather than being
display-only in a flat list.

## 8. Webhook signature result

All three Stripe webhook handlers (`stripe-wallet-webhook`,
`guest-wallet-webhook`, `stripe-marketplace-webhook`) read the raw body
and verify the signature correctly, rejecting on failure — confirmed
solid before this session. `stripe-marketplace-webhook` was missing
event-ID dedup (unlike its two siblings); fixed this session (§9).
**Not live-tested** — no test-mode webhook delivery was possible (§6).

## 9. Duplicate-payment result

Fixed at the code level, not live-tested:
- `stripe-marketplace-webhook` now dedupes by Stripe event ID.
- `wallet-payout` now passes an idempotency key to
  `stripe.payouts.create`.
- `wallet-transfer` now reserves its ledger row (unique
  `idempotency_key`) before any balance movement — a double-click or
  retry-after-timeout can no longer create two real transfers.

None of this was exercised against Stripe's actual API or a live retry —
see §16 for exactly what that would take.

## 10. KrePay dashboard result

Built and **live-verified** against a real authenticated session (a
cached session was available in this environment) with real Connect
balance, real transactions, real profile data:

- `FinancialSummaryPanel` — Wallet/Available/Pending/Committed, each with
  explicit currency + timestamp; Committed is a real escrow-milestone
  query, not invented.
- `TransactionDetailDrawer` + `PaymentStatusTimeline` — clickable
  transaction rows now open a real detail view with a status timeline
  that only shows states the data actually supports.
- `TrustControlsCard` — verification state, a plain-language
  what-we-can/can't-see statement, transaction history + support links.

Full detail and what wasn't checked (theme toggle, screen reader,
non-tested breakpoints): `KREPAY_UX_UI_REPORT.md`.

## 11. AI-powered features added

- **`krepay-ai-insights`** (new edge function) — summarizes the caller's
  own aggregated financial data (never raw line items or other users'
  data) via the existing Lovable AI gateway pattern, returns a plain-
  language summary, an anomaly flag, and a next-action suggestion.
  Clearly labeled "AI-generated" with a timestamp in the UI. **Not
  deployed** — no Supabase deploy access this session; its failure path
  (404/CORS) was live-verified instead, and handled gracefully (visible
  error + retry, no crash, no fake data).
- **`InvoiceChaseDrawer`** — wires up `send-invoice-chase`, an AI
  payment-reminder drafter that was already fully built server-side but
  had **zero frontend callers** before this session. Draft → user
  reviews/edits → user explicitly confirms send → `send-outreach-draft`
  executes only then. Surfaces "connect Gmail first" rather than failing
  silently if outreach email isn't configured. The AI never sends
  anything, approves anything, or alters any record by itself.

## 12. Routes tested

Live, in-browser, against a real session: `/thrivepay` (all 3 tabs).
Live, in-browser, geometry-verified: the Messages composer/Kreto overlap
at 1024/1280/1440px. Static/code-review only (not browser-tested):
`/opportunity-dashboard` accept/shortlist/reject flow,
`ApplyToOpportunityDialog`, `/profile/:userId` (ViewProfile company-identity
fix from earlier in this session), `CompanyOnboarding` redirect fix.

## 13. Security and RLS result

Two CRITICAL findings on `wallets`/`creator_wallets` (real money-creation
and payout-bypass holes, open since at least 2026-08-12 per this repo's
own prior audit) — migration written, **NOT applied**. This is the
headline result of this session: **`SECURITY_RELEASE_GATE.md` now reads
NOT CLEARED**, specifically because of these two, not as a formality.
Three lower-severity findings (webhook dedup, two dead endpoints,
missing idempotency) fixed in code. Full ranked list:
`KREPAY_PAYMENT_AUDIT.md` §6.

## 14. Test totals

`npm run test`: 74/74 passing, unchanged from this session's start — no
payment- or hire-specific automated tests exist in this codebase to add
coverage to that class of change; this number only confirms no
regression in what already existed. No new automated tests were added
this session (would require a Supabase RPC test harness — pgTAP or
equivalent — that doesn't exist in this repo yet; noted as a real gap in
`HIRE_NOTIFICATION_VERIFICATION.md`).

## 15. Baseline versus final failures

| Gate | Session start | Session end |
|---|---|---|
| `npm run typecheck` | 1 pre-existing error (`StudioAICreate.tsx`, unrelated) | Same 1 error, nothing new |
| `npm run lint` | ~9,465 errors / 909 warnings (pre-existing, mostly edge-function `no-explicit-any`) | No new errors introduced by this session's changes (spot-checked every touched file's new lint output against this baseline) |
| `npm run build` | Clean | Clean, same bundle-size warning as before |
| `npm run test` | 74/74 | 74/74 |

## 16. Files changed

33 files, +2,399/-390 across 8 commits. Full list: `git diff --stat
9b48e955..HEAD` (the commit this session started from). Grouped by
concern: 2 hire-loop files + 1 migration, 2 chat-layout files, 5
KrePay-security files (2 deleted) + 1 migration, 6 new KrePay dashboard
components + 1 new edge function + `ThrivePay.tsx`, plus 2 unrelated
brand-page fixes from earlier in the same session (`ViewProfile.tsx`,
`CompanyOnboarding.tsx`) and 7 documentation files.

## 17. Commits

```
ffb236fd fix(brand): render company identity on ViewProfile, fix onboarding redirect
e00cad18 fix(chat): stop Kreto launcher from overlapping the message send button
26f97f8b fix(hire): applicant never notified when accepted and Studio is created
eae5f217 fix(krepay): close two critical wallet RLS holes, harden webhook + payouts
ba328572 docs(krepay): document why Stripe sandbox testing is blocked this session
3fb9f71a feat(krepay): bank-style dashboard summary, transaction detail + AI insights
149fb7db docs(security): log today's KrePay/hire-loop findings, flip gate to NOT CLEARED
```

Nothing was pushed to `main`. Nothing was pushed to the remote at all
this session unless a separate push was explicitly requested.

## 18. Production actions still required

In priority order:

1. **Apply `20260823160000_krepay_security_hardening.sql`** — closes the
   two CRITICAL wallet vulnerabilities (KP-01/KP-02). This is the single
   highest-priority item in this entire report.
   *(corrected 2026-09-15: this repo never had a file named
   `20260823160000`/`20260823170000` in `supabase/migrations/` — confirmed
   absent from `git log --all`. The actual, committed fix for this class
   of finding is `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
   + `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
   A"), which was applied and independently confirmed closed — see
   `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`'s final status.)*
2. **Apply `20260823150000_hire_loop_notification_fix.sql`** — makes the
   hire-acceptance notification actually work.
3. **Run `supabase gen types`** after both are applied and diff the
   result against the hand-written entries added to
   `src/integrations/supabase/types.ts` this session — confirm they
   match exactly.
4. **Deploy the edited/new edge functions** —
   `krepay-ai-insights` (new), `stripe-marketplace-webhook`,
   `wallet-payout`, `wallet-transfer` (all edited) — and confirm
   `create-connect-payment`/`create-payment` are actually undeployed, not
   just deleted from source.
5. **Re-confirm Stripe key mode** via the Stripe dashboard or Supabase
   secrets, independent of the 2026-08-18 recorded confirmation, before
   any sandbox or live testing proceeds.
6. **Run the actual sandbox test matrix** (`KREPAY_STRIPE_SANDBOX_REPORT.md`)
   once a test-mode key is confirmed.
7. **Run the manual hire-loop verification checklist**
   (`HIRE_LOOP_AUDIT.md` §10) with two real test accounts once (1) is applied.

## 19. Remaining blockers

- No Supabase database access this session (migrations prepared, not
  applied) — requested again mid-session via the Supabase MCP connector;
  it remained in an unauthenticated state and this session cannot
  complete the OAuth flow needed to authorize it.
- No Supabase CLI/dashboard access (can't deploy edge functions, can't
  independently verify Stripe key mode, can't confirm webhook endpoint
  registration).
- Stripe confirmed live-mode, so all sandbox/E2E payment testing stayed
  blocked all session by design, not oversight.
- No automated RPC/payment test infrastructure exists in this repo to add
  real regression coverage to the RPCs and idempotency logic written this
  session — `npm run test` passing 74/74 does not cover any of it.
