# Lovable Cloud Migration Runbook

**(corrected 2026-09-15)**: `20260823160000_krepay_security_hardening.sql`
and `20260823170000_krepay_security_hardening_followup.sql`, named
throughout this runbook, were never actually committed to this repo as
files under `supabase/migrations/` — confirmed absent from `git log
--all`. They only ever existed as SQL blocks quoted inline in
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md`. The wallet/creator_wallets/profiles
privilege-drift problem this runbook was written to help apply/verify was
subsequently closed by a different, genuinely-committed pair of
migrations — `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
+ `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
A") — which was applied and independently confirmed closed (see
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md`'s final status and
`WALLET_SECURITY_VERIFICATION_REPORT.md`). The procedure below is left
intact for historical record; do not follow it as a live action item.

Prepared while access is `BLOCKED_LOVABLE_CLOUD_ACCESS` (see
`LOVABLE_CLOUD_ACCESS_REPORT.md`). This is the procedure to follow once
either the MCP connector or a correctly-scoped local CLI link is
available — until then, everything below is executed by you, manually,
in the Lovable Cloud SQL editor, exactly as every prior step in this
engagement has been.

## 1. Migration inventory

Every migration this session's investigation actually concerns (the full
repo has a much longer history; these are the ones with open questions):

| Migration | Purpose | Affected tables/objects | Grants/revokes | Status as of this report |
|---|---|---|---|---|
| `20260823150000_hire_loop_notification_fix.sql` | Fixes the hire-acceptance notification bug (RLS fix broke a client-side cross-user insert) | `notifications` (new `dedupe_key` col+index), `projects` (new `source_application_id` col+index), 3 new `SECURITY DEFINER` RPCs | None (no REVOKE/GRANT beyond `GRANT EXECUTE` on the 3 new functions to `authenticated`) | **Not confirmed applied.** Never asked to be applied this session — work stayed focused on the wallet findings. Independent of everything below (§3 of `PRIVILEGE_DRIFT_INVESTIGATION.md` confirms no dependency). |
| `20260823160000_krepay_security_hardening.sql` | Column-level `REVOKE UPDATE` on `wallets`(balance,credits) and `creator_wallets`(kyc_status,payouts_enabled,charges_enabled,stripe_account_id,requirements) | `wallets`, `creator_wallets` | Column-level `REVOKE` only | **Reported applied**, then verification showed 5/6 target columns correctly locked and 1 (`creator_wallets.stripe_account_id`) still open. |
| `20260823170000_krepay_security_hardening_followup.sql` | Closes the residual `stripe_account_id` gap plus the newly-found `profiles.stripe_account_id`/`stripe_account_status` gap | `creator_wallets`, `profiles` | Column-level `REVOKE` only | **Reported applied**, then a full re-verification found **all 8 target columns across all 3 tables** open again for both `authenticated` and `anon` — a complete reversal, including columns previously confirmed locked. |
| (ad hoc) Combined stop-gap re-`REVOKE` (all 3 statements from both migrations above, re-issued as one script) | Immediate re-closure attempt after the reversal | Same 3 tables | Column-level `REVOKE`, re-issued | **Reported run "with success."** No subsequent verification query result was received — durability of this re-application is **unconfirmed**, not "verified," not "stable." This is the actual current unknown this runbook exists to resolve. |

**Do not treat "reported applied" or "ran with success" as equivalent to
verified.** This exact gap — an applied statement with no follow-up
verification — is what produced the false "fixed" conclusion earlier in
this engagement. Every "Status" cell above states precisely what is and
isn't known; none should be read as more confident than written.

## 2. Root cause on record (not re-litigated here)

Full detail in `PRIVILEGE_DRIFT_INVESTIGATION.md`. Short version:
`public.creator_wallets` was created with an explicit **table-level**
`GRANT UPDATE ... TO authenticated` (`20260528125850_...sql:15`) that no
column-level `REVOKE` can override — this is standard Postgres ACL
behavior, not a bug or a platform quirk. `wallets` and `profiles` are
suspected to carry the equivalent via Supabase's project-level default
privileges (unconfirmed without a live `pg_default_acl` query — see the
Step 0 query in `WALLET_ACCESS_REMEDIATION_PLAN.md`). Any application of
these migrations should be preceded by that confirmation query so
whoever applies them knows whether a table-level `REVOKE` (not just
column-level) is actually required for `wallets`/`profiles` too.

## 3. Procedure once access is confirmed

1. Read Lovable Cloud's actual migration history (however that's
   surfaced once access exists — a migrations table, a CLI command, or
   the Cloud dashboard).
2. Compare against the local filenames in `supabase/migrations/` —
   specifically confirm whether `20260823150000`, `20260823160000`, and
   `20260823170000` are recorded as applied, and cross-reference against
   the "Status" column in §1's table, which reflects what was *reported*
   by hand this session, not what's *recorded* by the platform. A
   mismatch between the two is itself a finding worth surfacing, not
   something to silently reconcile.
3. Run the Step 0 confirmation query from
   `WALLET_ACCESS_REMEDIATION_PLAN.md` (the `has_table_privilege` +
   `pg_default_acl` check) to determine, with certainty this time,
   whether `wallets` and `profiles` need the table-level `REVOKE` +
   narrow re-`GRANT` treatment (`WALLET_ACCESS_REMEDIATION_PLAN.md`
   Steps 1-2) beyond what's already been attempted.
4. If a table-level `REVOKE` is needed and hasn't been applied, apply it
   — this is the step most likely to actually be the durable fix, since
   every column-level attempt so far has been either partially or fully
   ineffective for the reason in §2.
5. Immediately re-run the full verification query (the one given at the
   end of the prior turn in this session — `has_table_privilege`/
   `has_column_privilege` across all three tables) and require the
   **actual pasted result**, not just confirmation the statement ran, before
   updating any status.
6. Run the full negative-test matrix
   (`KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md`) — grant-layer verification
   alone has already produced one false-positive "fixed" conclusion this
   session; an actual attempted `PATCH` per scenario is the
   higher-confidence check.
7. Only after both (5) and (6) pass should `WALLET_SECURITY_VERIFICATION_REPORT.md`
   be updated to anything stronger than "pending."
8. Consider `WALLET_ACCESS_REMEDIATION_PLAN.md` Step 5 (an event trigger
   or scheduled re-check) so a *third* silent reversal, if one occurs,
   produces a timestamped record instead of requiring another manual
   side-by-side comparison to notice.

## 4. If Lovable Cloud auto-syncs from Git

Not yet confirmed either way whether this project has that behavior. If
it does, and it applies `20260823150000`/`20260823160000`/`20260823170000`
automatically from this branch: confirm the applied migration ID/hash
matches this repo's file exactly, and do **not** re-run any of them
manually in the SQL editor afterward — that would either error (already
applied) or, worse, silently succeed as a duplicate operation. Given the
migrations' `REVOKE`/`GRANT`/`ADD COLUMN IF NOT EXISTS` statements are
individually idempotent, a duplicate run is low-risk but still not
something to do without confirming it's actually necessary first.
