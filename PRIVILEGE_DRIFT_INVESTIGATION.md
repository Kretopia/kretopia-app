# Privilege Drift Investigation — `wallets` / `creator_wallets` / `profiles`

Read-only. No SQL was applied, nothing was deployed, no production data
was modified or viewed while producing this document. Every claim below
is cited to an exact file and line in this repo's tracked migration
history — nothing here is inferred from the earlier session's live query
results alone.

**This investigation does not assume malicious activity, does not assume
Lovable is responsible, and does not claim any fix is durable.** Where a
question can't be answered from static code alone, that is stated
explicitly rather than guessed.

---

## 1. Exact migrations inspected

Every migration touching any of the three tables, found by
`grep -rn "GRANT\|REVOKE" supabase/migrations/*.sql | grep -E "ON public\.(wallets|creator_wallets|profiles)\b"` plus a full read of each table's original `CREATE TABLE` statement:

| Migration | What it does to these tables |
|---|---|
| `20250930073034_21346291-5bef-42d1-8439-e372ed607250.sql` | Creates `public.profiles`. RLS enabled. Three policies: SELECT (`USING (true)`), UPDATE (`USING (auth.uid()=user_id)`, no `WITH CHECK`), INSERT (`WITH CHECK (auth.uid()=user_id)`). **No explicit `GRANT`/`REVOKE` statement anywhere in this file.** |
| `20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql` | Creates `public.wallets`. RLS enabled. Three policies, same shape as `profiles` (SELECT/INSERT/UPDATE, `USING (auth.uid()=user_id)`, no `WITH CHECK` on UPDATE). **No explicit `GRANT`/`REVOKE` statement anywhere in this file.** |
| `20260502224404_d273510f-ca92-46e7-8954-030ab40c3cae.sql:23` | `REVOKE SELECT (phone_otp, phone_otp_expires_at) ON public.profiles FROM authenticated, anon;` — SELECT only, unrelated columns. |
| `20260528125850_6b5c8803-258c-4ced-b9cc-908a22fa1308.sql:3-20` | Creates `public.creator_wallets`. **Line 15: `GRANT SELECT, INSERT, UPDATE ON public.creator_wallets TO authenticated;`** — an explicit, unambiguous **table-level** grant, covering every column. Line 16: `GRANT ALL ON public.creator_wallets TO service_role;`. RLS enabled; UPDATE policy `USING (auth.uid()=user_id)`, no `WITH CHECK`. |
| `20260803091710_8f59697e-2bc6-40fc-be79-87f720d68322.sql:2,18-19,22` | `profiles`: blanket `REVOKE SELECT ON public.profiles FROM anon, authenticated;` (line 2), then a dynamic `EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols)` / same for `anon` (lines 18-19) re-granting SELECT on an explicit, approved column list only. `GRANT ALL ON public.profiles TO service_role;` (line 22). **This migration carefully manages SELECT with a revoke-then-selectively-regrant pattern. It does not touch UPDATE at all.** |
| `20260823160000_krepay_security_hardening.sql:33,52-53` | `REVOKE UPDATE (balance, credits) ON public.wallets FROM authenticated, anon;` and `REVOKE UPDATE (kyc_status, payouts_enabled, charges_enabled, stripe_account_id, requirements) ON public.creator_wallets FROM authenticated, anon;` — both **column-level**. |
| `20260823170000_krepay_security_hardening_followup.sql:40,72` | `REVOKE UPDATE (stripe_account_id) ON public.creator_wallets FROM authenticated, anon;` and `REVOKE UPDATE (stripe_account_id, stripe_account_status) ON public.profiles FROM authenticated, anon;` — both **column-level**. |

No other migration in this repo touches `GRANT`/`REVOKE`/`ALTER TABLE ... OWNER` for any of these three tables. Confirmed via `grep -rn "ON public\.wallets\b\|ON public\.creator_wallets\b\|ON public\.profiles\b" supabase/migrations/*.sql` returning exactly the rows above plus RLS `CREATE POLICY` statements.

**(corrected 2026-09-15)**: the two files cited in the last two rows above
were never actually committed to `supabase/migrations/` in this repo —
confirmed absent from `git log --all`. The line numbers cited trace to
SQL blocks quoted inline in `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`, not to
files in the migrations directory, which is consistent with this
document's own §6 finding that no broad re-grant exists anywhere in
tracked migration history. The privilege-drift problem this investigation
diagnosed was subsequently closed by a different, genuinely-committed
pair — `supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
+ `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
A") — which drops the permissive RLS policies outright rather than
attempting a column-level `REVOKE` against a coexisting table-level
grant, and was independently confirmed closed (see
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md`'s final status).

---

## 2. What was actually revoked, by category

| Category | `wallets` | `creator_wallets` | `profiles` |
|---|---|---|---|
| Table-level UPDATE | **Never revoked — never explicitly granted either; see §3** | **Never revoked.** Only `stripe_account_id` (5th column) was later added to a column-level revoke; the table-level grant from creation (`...5850:15`) was never touched | **Never revoked** |
| Column-level UPDATE | `balance`, `credits` (`...160000:33`) | `kyc_status`, `payouts_enabled`, `charges_enabled`, `stripe_account_id`, `requirements` (`...160000:52-53`, `...170000:40`) | `stripe_account_id`, `stripe_account_status` (`...170000:72`) |
| Privileges from `PUBLIC` (the pseudo-role) | Not addressed by any migration | Not addressed | Not addressed |
| Privileges directly from `anon` | Column-level only, same statements as `authenticated` above | Same | Same |
| Privileges directly from `authenticated` | Column-level only | Column-level only | Column-level only |
| `ALTER DEFAULT PRIVILEGES` | None issued anywhere in this repo's history for `public` schema tables (only `net` schema, unrelated — `20251020015856_...sql:9-11`) | Same | Same |
| Sequence privileges | **Not applicable** — `wallets.id` is `uuid DEFAULT gen_random_uuid()`, no `SERIAL`/`IDENTITY` column exists on any of the three tables (confirmed: zero matches for `SERIAL`/`BIGSERIAL`/`GENERATED ... IDENTITY` in any of the three `CREATE TABLE` statements) | N/A | N/A |

**Every REVOKE issued this session, across both migrations, was column-level, and none of them touched the `PUBLIC` pseudo-role.**

---

## 3. Can a table-level UPDATE grant still override the intended column restriction?

**Yes — this is standard, documented PostgreSQL behavior, not a bug or
platform quirk.** A role can `UPDATE` a column if it holds *either* a
table-level `UPDATE` privilege (which applies to every column
unconditionally) *or* a column-level `UPDATE` privilege scoped to that
specific column. A column-level `REVOKE` removes only a column-level ACL
entry — it has no mechanism to reach or narrow a separate table-level
grant. If a table-level `UPDATE` grant to a role exists, that role
retains full `UPDATE` on every column of the table regardless of any
column-level `REVOKE` naming those columns.

**Confirmed present, by direct evidence**: `public.creator_wallets` has
an explicit table-level `GRANT ... UPDATE ... TO authenticated`
(`20260528125850_...sql:15`), issued at table creation, **never revoked
by anything in this repo's migration history**. This alone is sufficient
to explain why `authenticated` can update every column of
`creator_wallets` — including the five this session tried to
column-level-revoke — independent of any external event.

**Not directly confirmed, but the same pattern very likely applies to
`wallets` and `profiles`**: neither table's creation migration contains
*any* explicit `GRANT` statement (§1). Every Supabase project is
bootstrapped with a project-level `ALTER DEFAULT PRIVILEGES ... GRANT ALL
ON TABLES TO anon, authenticated, service_role` (Supabase's standard
template, applied once at project provisioning, outside the tracked
migration history — this is why most tables in this repo never carry an
explicit `GRANT` in their own creation migration, `creator_wallets`
being the one visible exception where a human apparently added one
explicitly anyway). If that standard default is in effect on this
project — which cannot be confirmed without running §5's default-privilege
query against the live database — then `wallets` and `profiles` also
carry an invisible-in-this-repo table-level `UPDATE` grant to
`authenticated` (and likely `anon`) from the moment each table was
created, and this session's column-level `REVOKE` statements for those
two tables would have been structurally insufficient in exactly the same
way as `creator_wallets`, from the start — **not because anything
"undid" them later**.

---

## 4. Are privileges granted directly to `anon` / `authenticated` / `PUBLIC` / another role?

- `creator_wallets`: directly to `authenticated` (`...5850:15`, table-level), directly to `service_role` (`...5850:16`, table-level `ALL`). No grant to `anon` found anywhere in this repo's history for this table — if `anon` has `UPDATE` on it today, that did not come from any statement in this codebase.
- `wallets`, `profiles`: no explicit direct grant found in this repo for either `authenticated` or `anon` on `UPDATE` — see §3's default-privileges caveat.
- `PUBLIC` (the pseudo-role every role implicitly is a member of): **no statement anywhere in this repo's history grants or revokes anything on these three tables to/from `PUBLIC` by name.** If `PUBLIC` holds a grant on any of these tables, it would have to come from Postgres's own default behavior for object creation (by default, `CREATE TABLE` does *not* grant anything to `PUBLIC` in modern PostgreSQL — the historical default of granting to `PUBLIC` was removed in Postgres 15's handling of schema-level `CREATE`, but a table's own privileges have never defaulted to `PUBLIC` automatically; this would need explicit confirmation via query 1/2 in `PRIVILEGE_VERIFICATION_QUERIES.sql`).
- No other named role (e.g., a custom role, a group role) appears in any `GRANT`/`REVOKE` statement touching these three tables anywhere in this repo.

---

## 5. Could `ALTER DEFAULT PRIVILEGES` reintroduce access?

For *existing* columns on *existing* tables — no. `ALTER DEFAULT
PRIVILEGES` only affects privileges automatically applied to objects
**created after** the default-privileges statement runs; it has no
retroactive effect on a table or column that already exists. It cannot,
by itself, explain privileges reappearing on `wallets.balance` (an
existing column) after a `REVOKE` ran against that same existing column.

It **is** directly relevant to explaining why `wallets` and `profiles`
may never have needed an explicit `GRANT` in this repo to already have
table-level access (§3) — if a project-level `ALTER DEFAULT PRIVILEGES
... GRANT ALL ON TABLES TO authenticated, anon` was set at project
creation (standard Supabase behavior, not tracked in this repo), every
table created afterward — including `wallets` and `profiles` — would
have received that grant automatically and invisibly to `git log`.
Query 5 in `PRIVILEGE_VERIFICATION_QUERIES.sql` (`pg_default_acl`) is the
only way to confirm this either way; it was not run in this
investigation (read-only, no DB access this session).

---

## 6. Any migration, generated schema file, database push, schema editor, or platform sync containing broad `GRANT` statements?

Searched this entire repository, not just `supabase/migrations/`:

- `find . -maxdepth 3 -iname "*.sql" -not -path "./supabase/migrations/*"` — **zero results**. No standalone schema dump, Prisma/Drizzle schema file, or any other `.sql` file exists outside the tracked migrations directory.
- No `schema.prisma`, `schema.graphql`, or similar generated-schema artifact found anywhere in the repo root or immediate subdirectories.
- Within `supabase/migrations/`, the only `GRANT ALL ON ALL TABLES IN SCHEMA ... schema ...` or `ALTER DEFAULT PRIVILEGES ... schema ...` statements found are scoped to the `net` schema (Postgres's `pg_net` HTTP-extension schema, unrelated to application tables — `20251020015856_...sql:6,9-11`). **No broad grant touching the `public` schema exists anywhere in this repo's tracked SQL.**

This rules out "a committed migration in this repo did it" as the
mechanism. It does **not** rule out something outside this repo's
tracked files — a manual `GRANT` run directly against the database, or
platform-level tooling (Lovable's schema sync, a "push to database"
action, or Supabase's own project-bootstrap defaults) operating outside
version control entirely. This investigation has no way to observe
either of those without database audit-log access, which this session
does not have.

---

## 7. Could the affected tables have been recreated or replaced?

No evidence of this. `grep` for `DROP TABLE`/`CREATE TABLE` naming any of
the three tables across the full migration history returns exactly one
`CREATE TABLE` per table (§1's table), no `DROP TABLE`, no second
`CREATE TABLE` for the same name. A table recreation (which would reset
all privileges to whatever `CREATE TABLE` + default-privileges produces,
wiping any prior `REVOKE`) is not supported by anything in the tracked
migration history. It remains possible via an out-of-band operation this
investigation cannot see (e.g., a schema-editor "regenerate table"
action), but there is no positive evidence for it — this is noted as an
open possibility, not a finding.

---

## 8. Does a safe server-side write path still exist regardless of the above?

**Yes, and this part was independently re-confirmed live during the
prior session** (not re-verified in this read-only pass, cited from that
session's result): `public.wallet_debit` / `public.wallet_credit`
(`20260804103153_...sql`) are `SECURITY DEFINER`, `SET search_path =
public`, and — critically — `REVOKE ALL ... FROM public, anon,
authenticated; GRANT EXECUTE ... TO service_role` **only**. A live query
(`has_function_privilege`) run in the prior session confirmed
`can_execute = false` for `authenticated`/`anon` and `true` only for
`service_role`.

This matters because it means: **even in the worst case where every
`wallets`/`creator_wallets`/`profiles` column-level `REVOKE` in this
session turns out to have no practical effect** (because a table-level
grant subsumes it, per §3), the actual balance-mutating functions
(`wallet_debit`/`wallet_credit`) remain unreachable by any client
session directly — a client can still forge `wallets.balance` via a raw
`PATCH` (the original KP-01 exploit), but cannot call `wallet_debit`/
`wallet_credit` directly to bypass their own atomic
`balance >= amount` check. The exploit path for KP-01 (§2 of
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md`) remains exactly what it was
before any of this session's fixes — a direct `PATCH` to the row, not a
function call — and that path is what the (apparently ineffective)
column-level `REVOKE` was meant to close.

The three hire-loop RPCs (`accept_application`,
`notify_application_status`, `notify_new_application`, added in
`20260823150000_...sql`) are unrelated to this investigation's tables
and were not re-examined here — they were fully audited in
`KREPAY_CRITICAL_SECURITY_RUNBOOK.md` §8 and are not implicated in any
finding above.

---

## 9. No customer records, balances, or secrets were exposed

Every query prepared in `PRIVILEGE_VERIFICATION_QUERIES.sql` targets
catalog/metadata objects (`information_schema`, `pg_class`,
`pg_attribute`, `pg_policies`, `pg_proc`, `pg_default_acl`) — none select
from `wallets`, `creator_wallets`, `profiles`, or any other data table.
This document quotes no balance, no Stripe account ID, no user ID, no
row content of any kind — only migration file paths, line numbers, and
SQL statement text that was already committed to this repository before
this investigation began.

---

## Summary — most likely root cause

**The column-level `REVOKE` statements issued in this session were very
likely structurally insufficient from the moment they ran, not "undone"
by a later event.** `creator_wallets` had a table-level `UPDATE` grant
to `authenticated` since its creation (`...5850:15`) that this session
never revoked — only narrower, coexisting column-level entries were
touched, which cannot override it. `wallets` and `profiles` almost
certainly have the equivalent table-level access via Supabase's standard
project-level default privileges, invisible to this repo's migration
history. This is a **plausible, evidence-supported explanation that
requires no assumption of malicious activity or platform misbehavior** —
it is a gap in how the fix was constructed, not necessarily a gap in how
the platform behaves. It has not been confirmed with certainty (that
would require running §5's `pg_default_acl` query and §2's
`information_schema.role_table_grants` query against the live database),
and an out-of-band re-grant remains a possibility this investigation
cannot rule out. Both must be checked live before either explanation is
treated as settled.

**Status: `PRIVILEGE_DRIFT_UNDER_INVESTIGATION`.**

**Update**: the `pg_default_acl` and `information_schema.role_table_grants`
queries that would confirm or rule out the table-level-grant hypothesis
for `wallets`/`profiles` specifically have not been run — this session
subsequently lost the ability to hand over further ad hoc queries and
receive results mid-conversation in the same way, and is now
`BLOCKED_LOVABLE_CLOUD_ACCESS` (see `LOVABLE_CLOUD_ACCESS_REPORT.md`).
The confirmation query remains exactly as specified in
`WALLET_ACCESS_REMEDIATION_PLAN.md` Step 0 — nothing about the
investigation's conclusion has changed, only its next step is now
gated on restored access or a manual run via the Lovable Cloud SQL
editor.
