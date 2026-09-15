# Hire → KrePay End-to-End Report

## Status: partially exercised, not fully run

The requested 16-step connected loop (post opportunity → apply → message →
interview → accept → Studio → notification → open Studio → milestone →
Stripe payment → webhook → KrePay state → authorized visibility → duplicate
rejection → review/completion) requires three things this session doesn't
have: **two distinct real test accounts** to drive both sides of the hire
flow, **the new migrations actually applied** to a database (so
`accept_application` and the RLS hardening exist to call), and — for the
payment steps specifically — **a confirmed Stripe test-mode key**, which
is blocked (see `KREPAY_STRIPE_SANDBOX_REPORT.md`). None of the three
were available, so this is not a claim that the full loop works — it's an
honest breakdown of what was and wasn't checked, and why.

## What was actually verified this session

| Step | Verified how | Result |
|---|---|---|
| Hire workflow code trace (apply → message → interview → accept → Studio → notify) | Full static trace, file:line cited throughout | `HIRE_LOOP_AUDIT.md` — root cause found and fixed in code (not yet applied) |
| Chat composer / Kreto overlap | Live browser measurement at 1024/1280/1440px, real components | Fixed and verified — see `KRETO_CHAT_LAYOUT_REPORT.md` |
| KrePay dashboard rendering (balance summary, transaction detail, trust panel) | Live browser session against real Supabase data (a cached auth session happened to be available) | Renders correctly with real `$0.00`/real transaction rows; see `KREPAY_UX_UI_REPORT.md` |
| `krepay-ai-insights` failure handling | Live — the function isn't deployed, so its actual 404/CORS failure was exercised for real | Fails visibly with a retry option, no crash, no fabricated data |
| `accept_application`, `notify_application_status`, `notify_new_application` RPCs | **Not run against a database** — no DB access | Code written, reviewed against real schema, not executed |
| Studio creation, applicant notification delivery | **Not run** — would require the migration applied plus two accounts | Not tested |
| Milestone creation, Stripe payment, webhook confirmation | **Not run** — blocked (live-mode Stripe, no sandbox) | Not tested — see `KREPAY_STRIPE_SANDBOX_REPORT.md` |
| Duplicate-payment / duplicate-acceptance rejection | **Not run** — same blockers | Not tested; the idempotency mechanisms (unique indexes, reserve-before-act) were reviewed by reading the SQL, not exercised |
| Authorized-visibility checks (each party sees only their own data) | Reviewed via RLS policy read, not a live two-account test | Policies traced and appear correct (see `HIRE_LOOP_AUDIT.md` §6); not empirically confirmed with two real sessions |

## Why this is reported honestly rather than marked done

The task's own instructions are explicit that a test "is not complete
until: Stripe reports the expected result; the local database reaches the
expected state; the UI reflects the server-confirmed state; the webhook is
processed; duplicate delivery is safe; the audit trail exists" — and,
separately, not to claim KrePay is operational without a completed
Stripe test-mode payment, verified webhook, and confirmed duplicate
handling. None of that was possible this session. Claiming the connected
loop "works" based on code review and single-surface UI checks alone would
be exactly the kind of unverified claim those rules exist to prevent.

## What would be needed to actually run this

1. **Apply both migrations** (`20260823150000_hire_loop_notification_fix.sql`,
   `20260823160000_krepay_security_hardening.sql`) to a database — ideally
   a non-production one first.
   *(corrected 2026-09-15: this repo never had a file named
   `20260823160000` in `supabase/migrations/` — confirmed absent from
   `git log --all`. The actual, committed fix for the wallet-RLS class of
   finding this pointed at is `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
   + `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql`, applied and
   confirmed closed — see `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`.)*
2. **Deploy `krepay-ai-insights`** (and confirm the other edited edge
   functions — `stripe-marketplace-webhook`, `wallet-payout`,
   `wallet-transfer` — are redeployed with today's changes).
3. **Two isolated test identities** (not real users), one as opportunity
   owner, one as applicant, to actually drive steps 1–9 of the requested
   loop and confirm the notification/Studio-access behavior live.
4. **A confirmed Stripe test-mode key** (or explicit sign-off to proceed
   differently) to run steps 10–15 — the milestone payment through
   duplicate-rejection portion — against Stripe's actual API and webhook
   delivery, which is the only way to genuinely confirm that part of the
   loop rather than reasoning about it from source.

## Regression gate for everything committed this session

Run after every commit in this session, not just once at the end:

| Command | Result |
|---|---|
| `npm run typecheck` | Clean except the pre-existing, unrelated `StudioAICreate.tsx` baseline error (present before this session started) |
| `npm run lint` | No new errors beyond the pre-existing ~9,465-error/~909-warning baseline (mostly `@typescript-eslint/no-explicit-any` in edge functions, unrelated to this session's changes) |
| `npm run build` | Clean, ~15s, no new warnings beyond the pre-existing bundle-size notice |
| `npm run test` | 74/74 passing throughout — no payment- or hire-specific automated tests exist in this suite to begin with, so this confirms no regression in existing coverage, not new coverage of what changed |
