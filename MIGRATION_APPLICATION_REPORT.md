# Migration Application Report

No migration was applied by this session directly — this session has no
access to the target database (`LOVABLE_CLOUD_ACCESS_REPORT.md`). Every
row below reflects what was manually applied by you in the Lovable Cloud
SQL editor and reported back in chat. Timestamps are left blank where
this session was never given an exact wall-clock time — do not treat a
blank as zero or as "unknown risk," it means exactly what it says:
not recorded.

**(corrected 2026-09-15)**: the two migration filenames in the table
below (`20260823160000_krepay_security_hardening.sql`,
`20260823170000_krepay_security_hardening_followup.sql`) were never
actually committed to this repo — confirmed absent from `git log --all`
against `supabase/migrations/`. They existed only as SQL blocks quoted
inline in `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`. Whatever was applied and
found reverted per this report's rows was applied directly against the
database, not through either of these files. The actual, committed fix
is `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
+ `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
A"), applied later and independently confirmed closed (see
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md`'s final status).

| Migration / statement | Target project (asserted) | Environment | Start time | End time | Result reported | Operator | Verification queries run after | Before/after security state |
|---|---|---|---|---|---|---|---|---|
| `20260823160000_krepay_security_hardening.sql` | Kretopia (`kwmcocsitwssrtzkdojh`) — not independently confirmed by this session, taken on your word | Production (Lovable Cloud) | not recorded | not recorded | Reported success | You, via Lovable Cloud SQL editor | Yes — `information_schema.column_privileges` query, unfiltered by `privilege_type` | Before: unknown (not queried pre-migration). After (first check): 5 of 6 target columns showed zero rows (correct); `creator_wallets.stripe_account_id` showed a lingering `UPDATE` grant |
| `20260823170000_krepay_security_hardening_followup.sql` | Same, unconfirmed | Production | not recorded | not recorded | Reported success ("Query succeeded. No rows returned.") | You | Yes — extended `information_schema.column_privileges` query, filtered to `privilege_type='UPDATE'` | After: **all 8 target columns across `wallets`/`creator_wallets`/`profiles`, both `authenticated` and `anon`**, showed an active `UPDATE` grant — a full reversal, including columns the first check had confirmed locked |
| Combined stop-gap (3 `REVOKE` statements from both migrations above, re-issued together) | Same, unconfirmed | Production | not recorded | not recorded | Reported success ("Combined stop-gap runned with success!") | You | **No verification query result was received after this.** A `has_table_privilege`/`has_column_privilege` query was prepared and provided but its result was never pasted back before the conversation moved to access-authorization topics. | Before: the full-reversal state above. After: **unknown — this is the open question this runbook exists to resolve** |

## What "reported success" means and doesn't mean

Every "Result reported" cell above reflects that the SQL editor did not
return an error — it does **not** mean the statement's intended effect
was confirmed to hold. This distinction produced a real false-positive
earlier in this session (the first migration was reported successful,
partially verified, and only later found — via a *second*, independent
verification — to have been ineffective for one column, with the
follow-up migration then found ineffective for *all* columns on a third
check). This report exists specifically so that gap doesn't repeat
silently: the last row's "Verification queries run after" is empty on
purpose, and that emptiness is itself the most important fact in this
document.

## Migrations not addressed by this report

`20260823150000_hire_loop_notification_fix.sql` was never reported as
applied or attempted this session — see
`LOVABLE_CLOUD_MIGRATION_RUNBOOK.md` §1 for its status. Every migration
in `supabase/migrations/` dated before `20260823150000` is assumed
already applied to production (this is a long-running project), but that
assumption was not independently re-verified against Lovable Cloud's own
migration history this session, since this session has no access to
query it.
