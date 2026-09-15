# Studio Finding 1 Remediation Plan

**Status: `BLOCKED_MIGRATION_NOT_APPLIED`** *(stale — see "STATUS UPDATE
(2026-09-15)" below; the migration has in fact been applied and the plan
below is kept for historical record.)*

## STATUS UPDATE (2026-09-15)

The status line above and the "Final status" section at the bottom of
this document are **stale**. Cross-checked against the migration files'
own comments, not assumed:

- `supabase/migrations/20260825100000_studio_role_based_money_rls.sql`
  (this plan's migration, §3 below) **has in fact been applied to
  production** — its own text describes itself as "PREPARED, NOT
  APPLIED," but that claim is contradicted by the two later migrations
  below, whose comments record direct, live evidence that it was already
  live in production before they ran.
- `supabase/migrations/20260910130000_fix_studio_money_rls_table_level_revoke.sql`
  records a real negative-test finding from **2026-09-10**: with
  `20260825100000` already applied, a direct REST `SELECT` of
  `milestones.amount`/`paid_to`/`paid_at`/`escrow_status`/
  `payment_intent_id` with an ordinary authenticated session **still
  succeeded and returned real values** — the column-level `REVOKE` in
  `20260825100000` had no practical effect on `milestones` because a
  pre-existing table-level `SELECT` grant was never removed (the
  equivalent check on `projects`' financial columns correctly returned
  403/42501 — that table was not leaking). This migration fixed the gap
  by revoking `SELECT` on `public.milestones` at the **table** level and
  re-granting only the non-financial columns.
- `supabase/migrations/20260913110000_milestones_select_grant_dynamic_exclusion.sql`
  hardened this further on **2026-09-13**: it converted the `milestones`
  re-grant from `20260910130000`'s hardcoded column allowlist to the same
  dynamic-exclusion-list pattern (`information_schema.columns` at
  migration time) already used for `projects`/`invoices`/`profiles`, so a
  future `ADD COLUMN` on `milestones` no longer needs someone to remember
  to update this file to avoid silently breaking reads for that new
  column.

**Net effect**: Finding 1's core fix (role-based money visibility on
`milestones`/`projects`) is applied and live. It was exploited in a
narrow, specific way — `milestones`' financial columns were readable via
direct REST `SELECT` between this migration's original apply and the
2026-09-10 fix — and has since been patched twice (2026-09-10 and
2026-09-13, both cited above). The negative tests in §6 below still
have not been confirmed run against the current, twice-hardened state;
until they are, treat "applied" as confirmed but "fully verified against
every scenario in §6" as still open.

The rest of this document, including the `BLOCKED_MIGRATION_NOT_APPLIED`
status line and "Final status" section below, is left intact as the
historical record of the plan as originally written — it does not
reflect the current state except where this section overrides it.

---

Remediation plan for `STUDIO_CURRENT_STATE_AUDIT.md` §7 finding 1
("No role-based RLS exists anywhere in Studio") and its direct
dependency, finding 2 (guest-link tiers not enforced). Findings 3
(`scope-guardian` IDOR), 4 (public-recap RLS broader than its
allowlist), and 5 (unauthenticated presence channel) are **explicitly
out of scope for this plan** — each is an independent code path
unrelated to the role/money-visibility mechanism this plan fixes, and
should be remediated separately so each fix stays reviewable on its own
merits.

Nothing in this plan has been applied. Migration file:
[`supabase/migrations/20260825100000_studio_role_based_money_rls.sql`](supabase/migrations/20260825100000_studio_role_based_money_rls.sql).
Edge Function code change: already made (not deployed) in
[`supabase/functions/redeem-project-guest-link/index.ts`](supabase/functions/redeem-project-guest-link/index.ts).

## 0. A correction made while preparing this plan

The audit's summary of finding 2 said guest-link redemptions leave
`role` "at the default" regardless of tier. Reading the actual code
while designing the fix found something more specific and more
serious: `redeem-project-guest-link/index.ts` (pre-fix) mapped
`contributor` → `role: 'collaborator'` and `commenter` → `role:
'commenter'` — only `viewer` actually landed on `'guest'`. No other
code path in the app ever writes `'collaborator'` or `'commenter'` as
a role value (grepped every INSERT/UPDATE of
`project_collaborators.role`). That means a guest-link "contributor"
was written with a role value textually **indistinguishable from a
real, fully-trusted team member** — which is fine today, only because
nothing reads `role` for anything security-relevant yet. The instant
role-based RLS exists (this plan), that stops being fine: a contributor
redeemed through a link becomes silently equivalent to an owner-invited
collaborator. This plan's migration and Edge Function fix close that
specific version of the gap, not just the milder one originally
summarized.

## 1. Target verification

Before running anything in §3–§6: confirm the Lovable Cloud SQL Editor
is connected to the **Kretopia** project (Supabase ref
`kwmcocsitwssrtzkdojh`) — same verification method used for every prior
migration this session (visual confirmation in the Lovable Cloud
dashboard; there is no single query that names the project back to
you).

## 2. Preflight queries — run these and record the output before applying anything

```sql
-- Preflight-1: does this migration's version already exist?
select version, name
from supabase_migrations.schema_migrations
where version::text = '20260825100000';
-- Expected: zero rows. If a row exists, stop -- this already ran;
-- skip to §5 (postflight) instead of re-applying.

-- Preflight-2: current distinct role values on project_collaborators,
-- with counts -- this is the load-bearing check for step 1 of the
-- migration (the UPDATE ... WHERE role IN ('collaborator','commenter')
-- cleanup). Record the exact counts.
select role, count(*) 
from public.project_collaborators
group by role
order by count(*) desc;
-- Expected, per code reading: 'member' (majority, standard invites),
-- some 'client'/'creative'/'guest' (agent-mode / guest-link viewers),
-- and some 'collaborator'/'commenter' (guest-link contributor/commenter
-- redemptions predating this fix -- these are exactly the rows the
-- migration's UPDATE step will normalize to 'guest'). If ANY value
-- outside {member, client, creative, guest, collaborator, commenter}
-- appears, STOP -- the migration's CHECK constraint will fail, and the
-- unexpected value needs to be understood before proceeding, not
-- silently mapped.

-- Preflight-3: current grants on the columns this migration will REVOKE
select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'milestones'
  and column_name in ('amount','paid_to','paid_at','escrow_status','payment_intent_id')
order by grantee, column_name;

select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'projects'
  and column_name in ('client_price','creative_payout','margin_type','margin_value')
order by grantee, column_name;
-- Expected: SELECT present for 'authenticated' on all of these today
-- (that's the vulnerability) -- confirms there's something real to revoke.

-- Preflight-4: confirm no existing function name collision
select proname from pg_proc
where proname in ('get_project_role','can_see_milestone_money',
  'get_milestone_financials','get_project_milestone_financials',
  'get_project_financials');
-- Expected: zero rows.

-- Preflight-5: row-count sanity baseline (to diff against postflight)
select count(*) from public.milestones;
select count(*) from public.projects;
select count(*) from public.project_collaborators;
```

## 3. The migration

Full text:
[`20260825100000_studio_role_based_money_rls.sql`](supabase/migrations/20260825100000_studio_role_based_money_rls.sql).
Summary of what it does, in order:

1. **Data cleanup**: normalizes any existing `project_collaborators.role`
   value of `'collaborator'` or `'commenter'` (both only ever written by
   the pre-fix guest-link redemption code) to `'guest'`.
2. **Adds a CHECK constraint** on `project_collaborators.role`,
   restricting it to `('member', 'client', 'creative', 'guest')`.
3. **`get_project_role(project_id, user_id)`** — server-side mirror of
   `useStudioRole.ts`'s exact role logic (owner via `created_by`, else
   normalized collaborator role, else NULL if not a member).
4. **`can_see_milestone_money(project_id, user_id)`** — TRUE for
   `owner`/`creative`/`collaborator`, FALSE for `client`/`guest`/
   non-members. This is the one rule; both RPCs below call it rather
   than each re-implementing it.
5. **`milestones`**: table-level `REVOKE SELECT` on `amount`, `paid_to`,
   `paid_at`, `escrow_status`, `payment_intent_id` from
   `authenticated`/`anon`, with a re-`GRANT` on every other column so
   non-financial reads (title/status/due_date-driven UI) are unaffected.
   Two new RPCs, `get_milestone_financials(id)` (single) and
   `get_project_milestone_financials(project_id)` (batch, for list
   views), both gated by `can_see_milestone_money`.
6. **`projects`**: table-level `REVOKE SELECT` on `client_price`,
   `creative_payout`, `margin_type`, `margin_value`, re-`GRANT`ing
   every other column dynamically (via `information_schema.columns` at
   migration time, so it doesn't go stale as the table grows — it has
   been altered by 14+ migrations already). New RPC
   `get_project_financials(project_id)`, **owner-only** (matches
   `useStudioRole.ts`'s documented `canSeeMoney: owner only` — see
   "Deliberately out of scope" below for why this is stricter than
   `useAgentRole.ts`'s intent, on purpose).

## 4. Required companion change — already made, not deployed

`redeem-project-guest-link/index.ts` now writes `role: 'guest'`
unconditionally for all three guest-link tiers (viewer/commenter/
contributor), instead of the previous `contributor→'collaborator'`/
`commenter→'commenter'` mapping. **Do not apply the SQL migration
without also deploying this Edge Function change in the same
release** — applying the SQL alone (data cleanup + CHECK constraint)
without this fix means the *next* contributor-tier guest-link
redemption would immediately violate the new CHECK constraint (since
the Edge Function would still try to insert `role: 'collaborator'`),
turning every future guest-link redemption into a hard 500 error until
both pieces ship together.

## 5. Postflight queries — run immediately after applying

```sql
-- Postflight-1: constraint is live
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.project_collaborators'::regclass
  and conname = 'project_collaborators_role_check';

-- Postflight-2: no more stray collaborator/commenter role values
select role, count(*) from public.project_collaborators
where role in ('collaborator', 'commenter')
group by role;
-- Expected: zero rows.

-- Postflight-3: financial columns no longer granted directly
select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'milestones'
  and column_name in ('amount','paid_to','paid_at','escrow_status','payment_intent_id')
  and grantee in ('authenticated','anon');
-- Expected: zero rows.

select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'projects'
  and column_name in ('client_price','creative_payout','margin_type','margin_value')
  and grantee in ('authenticated','anon');
-- Expected: zero rows.

-- Postflight-4: non-financial columns still readable (spot check)
select grantee, column_name from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'milestones'
  and column_name = 'title' and grantee = 'authenticated';
-- Expected: one row -- confirms the re-grant worked, not just the revoke.

-- Postflight-5: new functions exist with correct grants
select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_name in ('get_project_role','can_see_milestone_money',
  'get_milestone_financials','get_project_milestone_financials',
  'get_project_financials')
order by routine_name, grantee;
-- Expected: EXECUTE for 'authenticated' only, on every one of the 5 --
-- no anon, no PUBLIC.

-- Postflight-6: row counts unchanged from preflight-5 baseline
select count(*) from public.milestones;
select count(*) from public.projects;
select count(*) from public.project_collaborators;
```

## 6. Negative tests — real client-path, not SQL Editor proof

Following this engagement's standing rule: SQL Editor output alone does
not prove RLS, since it runs in a superuser context. These require two
real, distinct test identities — one set up as a project owner, one as
a `role='client'` or `role='guest'` collaborator on a project with at
least one milestone that has a non-null `amount`. Use the same
anon-key + real-JWT client path used throughout this session's other
negative-test reports (`ESCROW_RLS_NEGATIVE_TEST_REPORT.md`,
`WALLET_CLIENT_PATH_VERIFICATION_REPORT.md`).

```bash
# Test 1: client/guest-role collaborator direct-selects a milestone's
# financial columns via PostgREST -- expect the columns to come back
# NULL or the request to be rejected, not populated.
curl -s "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/milestones?id=eq.<milestone_id>&select=id,title,amount,paid_to,escrow_status" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $CLIENT_ROLE_JWT"
# Expected AFTER migration: either 400/403 (column permission denied)
# or 200 with amount/paid_to/escrow_status absent from the response --
# NOT the real amount. Record the exact response.

# Test 2: same collaborator calls get_milestone_financials directly
curl -s -X POST "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/rpc/get_milestone_financials" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $CLIENT_ROLE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"_milestone_id":"<milestone_id>"}'
# Expected: 200 with {"success":false,"error":"not_authorized"}

# Test 3: owner calls the same RPC for the same milestone
curl -s -X POST "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/rpc/get_milestone_financials" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"_milestone_id":"<milestone_id>"}'
# Expected: 200 with {"success":true,"amount":<real value>,...}

# Test 4: client/guest-role collaborator direct-selects projects'
# financial columns
curl -s "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/projects?id=eq.<project_id>&select=id,title,client_price,creative_payout" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $CLIENT_ROLE_JWT"
# Expected: client_price/creative_payout absent or request rejected.

# Test 5: a NON-owner, non-client, real 'member'-role collaborator
# (i.e. a normal invited creative) calls get_project_financials --
# should be REJECTED since this RPC is owner-only, not
# collaborator-inclusive like the milestones one.
curl -s -X POST "https://kwmcocsitwssrtzkdojh.supabase.co/rest/v1/rpc/get_project_financials" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer $MEMBER_ROLE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"_project_id":"<project_id>"}'
# Expected: 200 with {"success":false,"error":"not_authorized"}

# Test 6: redeem a fresh contributor-tier guest link (post-Edge-Function-fix)
# and confirm the resulting project_collaborators row has role='guest',
# not role='collaborator'.
# (Exercise via the real /desk/join/:token flow through the app UI,
# then inspect via the owner's own authenticated read -- not SQL Editor.)
```

Do not report this migration as applied/verified until tests 1–6 have
actually been run against the live post-migration database with real
output recorded — not assumed from reading the SQL.

## 7. Frontend consumers — reviewed individually, now implemented

Each of the 12 files below was read in full before touching anything,
per the "understand before you touch it" principle this section
originally deferred on. The result was better than expected: most of
these files receive `project`/`milestones` as props flowing down from
one single fetch point (`useProjectData.ts`), not independent queries —
fixing that one hook, plus three components with their own independent
fetches, covers all 12. Verified: typecheck (0 errors), test (83/83),
build (clean) after every change below.

| File | What was actually found | Change made |
|---|---|---|
| `src/hooks/useProjectData.ts` | **The real chokepoint.** Both `milestones` (line ~138) and `projects` (line ~104) are fetched here with `select("*")` and passed down as props to `ThriveDesk.tsx` → `StudioRoom`/`DeskTabContent` → every other component in this table. | Added `get_project_milestone_financials(project_id)` (batch RPC) and `get_project_financials(project_id)` calls alongside the existing selects, merged into the milestone rows / project object by id. Unauthorized viewers get milestone rows with `amount`/`paid_to`/`paid_at`/`escrow_status`/`payment_intent_id` left `undefined` rather than faked as `0`/`null`. |
| `src/components/project/MilestoneBoard.tsx` | Receives `milestones` as a **prop** — no independent fetch. Its own arithmetic (`Number(milestone.amount)` in 3 places, including the aggregate `totalAmount`/`paidAmount` sums) had no `|| 0` guard — one milestone with `amount === undefined` would have turned every total on the page into `NaN`. | Fixed automatically by the `useProjectData.ts` change for authorized viewers. Added `|| 0` fallbacks to the two aggregate sums and the batch-pay total, and a `milestone.amount == null ? "—" : ...` guard on the one per-card amount display that isn't already gated behind the owner-only action buttons (those two — "Approve & Release $X", "Pay Now $X" — are only ever rendered for `userRole === 'client'`, i.e. the real owner in `useProjectData`'s inverted-naming role, who is unconditionally authorized under `can_see_milestone_money`, so they were left as-is). |
| `src/components/project/finance/FinanceHub.tsx` | Also receives `milestones`/`project` as **props**. Its aggregate `totals` useMemo was already defensively written (`Number(m.amount \|\| 0)` throughout) — only the "unbilled milestones" nudge button's inline `${Number(m.amount).toFixed(0)}` was missing the fallback. | Fixed automatically for authorized viewers; added the one missing `\|\| 0` guard. |
| `src/components/project/studio/MilestoneStrip.tsx` | **Independent fetch** (`select("id, title, amount, status, due_date")`), not derived from `useProjectData`. Renders via `Intl.NumberFormat.format()`, which is not `undefined`-safe. | Added the batch RPC call alongside its own select, merged `amount` in by milestone id, changed the `amount` type to `number \| undefined`, and guarded the render (`m.amount === undefined ? "—" : fmt(...)`). Also converted its card button to the app-wide `.btn-glass` system while in the file (unrelated design-system consistency pass, not part of this security fix). |
| `src/components/project/PaymentDispute.tsx` | **Dead code** — zero importers anywhere in `src/`, confirmed by grep. Its `paymentIntentId`/`payment_intent_id` reference is a prop being *written* into a new `payment_disputes` row, not a read of `milestones.payment_intent_id`. | No change — nothing to fix in unreachable code. |
| `src/components/project/PaymentVerification.tsx` | **Dead code** — zero importers, same pattern as `ActivityTimeline.tsx`/`MobileProjectHub.tsx`/`ProjectNotes.tsx` from the original audit. Does read `milestone.amount`/`paid_to`/`escrow_status` via `select("*")`, which would break if this were ever wired up post-migration. | No change — flagged here for whoever eventually reaches for this component: it will need the same RPC treatment as `MilestoneStrip.tsx` before being mounted anywhere. |
| `src/components/project/ScopeGuardian.tsx` | The original checklist's grep hit was a **false positive** — its only `escrow_status` reference is `escrow_status: 'none'` inside an `INSERT` when creating new milestones from an AI-generated schedule, not a `SELECT` of existing data. This migration only revokes `SELECT`, not `INSERT`. | No change needed. |
| `src/components/project/studio/AutopilotProjectGuide.tsx` | Has its own `loadMilestones()` fetch (`select("id, title, amount, status")`), but tracing its render path confirmed it's **effectively owner-only in practice**: `StudioRoom.tsx`'s only trigger for opening this dialog is wrapped in `{isOwner && !project.setup_completed && (...)}` (`StudioRoom.tsx:415`) — nothing else ever sets `autopilotOpen = true`. The owner is unconditionally authorized under `can_see_milestone_money`. | No change needed. |
| `src/components/project/InvoiceGenerator.tsx` | The original checklist's grep hit was a **false positive** — every `.amount` reference here is an `invoices`-table or line-item `amount` (a completely different table/concept), not `milestones.amount`. | No change needed. |
| `src/components/project/ProjectTemplates.tsx` | Also a **false positive** — `milestone.amount` here is a field on a static, predefined *template* object (`selectedTemplate.milestones`), being inserted as the starting value for brand-new milestones, not a read of the live `milestones` table. | No change needed. |
| `src/components/project/finance/AgentFinanceSummary.tsx` | Receives `project` as a prop; already used `project?.client_price ?? null` / `project?.creative_payout ?? null` throughout — nullish coalescing already treats `undefined` the same as `null`. | No change needed — already safe by its own pre-existing defensive coding. |
| `src/components/project/studio/MoneySection.tsx` | Same pattern — `project.client_price ?? project.creative_payout ?? null`, already `undefined`-safe. | No change needed. |
| `src/hooks/useProjectMoneySignal.ts` | Receives `project` as a parameter; only does truthy checks (`!!(project?.budget \|\| project?.client_price \|\| project?.creative_payout)`) — no arithmetic, no `undefined`/`NaN` risk. A non-owner will now see `hasBudget` computed from `budget`/`deal_type` alone when the owner-only fields are hidden, which is a minor, correct-direction (fails closed, not open) visibility change, not a bug. | No change needed. |

**Net result: 4 of 12 files needed real changes** (`useProjectData.ts`
plus 3 consumers with their own independent fetches or missing
arithmetic guards); the other 8 turned out to be dead code, false
positives from the original broad grep, or already-defensive code that
started working correctly the moment the central hook was fixed. This
validates the original caution about not batch-rewriting all 12 blind —
most of them didn't need it.

## 8. Deliberately out of scope for this specific fix

- **Per-milestone "only see your own" tightening.** The current rule
  (`owner`/`creative`/`collaborator` all see all of a project's
  milestone amounts; only `client`/`guest` are excluded) is the minimal
  fix for the literal, documented violation. A stricter rule — e.g., a
  creative only sees milestones where they are `paid_to` — is plausible
  future product intent but isn't specified anywhere in the Feature
  Bible or `useStudioRole.ts`'s own doc comments, so it isn't assumed
  here.
- **`useAgentRole.ts`'s per-party financial split** (client sees their
  own `client_price`, creative sees their own `creative_payout`, both
  hidden from each other, margin hidden from both). This migration
  makes all four `projects` financial columns owner-only, which is
  *stricter* than agent-mode's intent but never leaks to the wrong
  party — it only over-restricts a legitimate agent-mode view. Building
  the correct per-party RPC for agent-mode is real, separate design
  work (needs to know exactly which UI surfaces read `canSeeClientPrice`/
  `canSeeCreativePayout` today and confirm they're all owner-adjacent
  enough to tolerate this interim restriction) — flagged as a next
  step, not bundled in here to keep this migration reviewable.
- **Findings 3, 4, 5** — independent code paths, separate remediation
  plans.

## Final status

*(See "STATUS UPDATE (2026-09-15)" near the top of this document — this
section is stale and kept for historical record only.)*

`BLOCKED_MIGRATION_NOT_APPLIED`. Nothing in §3–§4 has been applied or
deployed. §7's frontend checklist is now fully reviewed and implemented
(4 of 12 files needed real changes; verified clean typecheck/test/build)
— the codebase is ready for the migration to be applied without
breaking legitimate owner/creative reads. Do not apply the SQL without
deploying the Edge Function change in the same release (§4), and do not
consider finding 1 closed until the negative tests in §6 have actually
been run against the live database and passed — code readiness is not
the same as verified enforcement.
