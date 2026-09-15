# Wallet Security Verification Report

**Status: `FIX_APPLIED_AND_VERIFIED`** (updated 2026-08-24, post-merge).
All four findings — KP-01 (`wallets.balance`/`credits` forgery), KP-02
(`creator_wallets.payouts_enabled` bypass), and the two related findings
found while investigating them (`creator_wallets.stripe_account_id`,
`profiles.stripe_account_id`/`stripe_account_status`) — are confirmed
closed by a live query against the actual fix now in place (see
§"Verification result" below). This supersedes every earlier status in
this document; the timeline below is kept for the record, not because
anything in it is still the live state.

## Timeline of what's actually known

1. Two CRITICAL vulnerabilities identified via static code audit
   (`KREPAY_PAYMENT_AUDIT.md`), migration written
   (`20260823160000_krepay_security_hardening.sql`).
   *(corrected 2026-09-15: this filename, and `20260823170000_...sql`
   referenced in step 3 below, were never actually committed to
   `supabase/migrations/` in this repo — confirmed absent from `git log
   --all`. They existed only as SQL blocks quoted inline in
   `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`. This timeline's steps 1-6 are
   accurate as a historical record of what was attempted, but the fix
   that actually landed and is confirmed live today is the different,
   genuinely-committed "Migration A" pair described in the "Update
   2026-08-24" section further down this document.)*
2. Migration reported applied. First verification: 5 of 6 target columns
   correctly locked; `creator_wallets.stripe_account_id` still open.
3. Investigating that gap surfaced a related, more severe finding:
   `profiles.stripe_account_id`/`stripe_account_status` had the identical
   unrestricted-`UPDATE` issue, feeding a live Stripe Express dashboard
   login-link call (`create-connect-login-link`) — a real third-party
   account-takeover path, not just an internal gate. Follow-up migration
   written (`20260823170000_...sql`).
4. Follow-up reported applied. Extended re-verification (all 8 columns,
   filtered to `privilege_type='UPDATE'`): **complete reversal** — every
   column across all three tables open again for both roles.
5. Root cause investigated (`PRIVILEGE_DRIFT_INVESTIGATION.md`):
   `creator_wallets` was created with an explicit table-level
   `GRANT UPDATE ... TO authenticated` that no column-level `REVOKE`
   could ever have overridden — likely explains the *entire* pattern,
   not external drift, though this remains unconfirmed for `wallets`/
   `profiles` specifically without a live `pg_default_acl` query.
6. A combined stop-gap (re-issuing all three `REVOKE` statements) was
   applied and reported successful.
7. **No verification query result was received after step 6.** A
   `has_table_privilege`/`has_column_privilege`-based query was prepared
   and handed over specifically to close this gap, but the session moved
   to Lovable Cloud access-authorization topics before a result came
   back.

## Current state: honestly unknown

Given the pattern in steps 2-4 — a reported-successful `REVOKE` that
verification later showed was ineffective, twice — **the only
responsible position is that step 6's effect is unconfirmed, not
verified, and not assumed stable.** It may hold. It may not. The
specific reason to suspect it might not (the table-level grant on
`creator_wallets`, and the suspected-but-unconfirmed equivalent on
`wallets`/`profiles`) was identified only *after* the stop-gap was
applied, meaning the stop-gap itself was another column-level-only
`REVOKE` — the same category of action that has already failed to hold
twice in this exact investigation.

## What would actually confirm this is fixed

1. The verification query from the end of the prior turn, run and its
   *result* — not just "it ran" — reported back:

```sql
SELECT 'table-level' AS scope, 'wallets' AS tbl, 'authenticated' AS role, has_table_privilege('authenticated', 'public.wallets', 'UPDATE') AS can_update
UNION ALL SELECT 'table-level', 'wallets', 'anon', has_table_privilege('anon', 'public.wallets', 'UPDATE')
UNION ALL SELECT 'table-level', 'creator_wallets', 'authenticated', has_table_privilege('authenticated', 'public.creator_wallets', 'UPDATE')
UNION ALL SELECT 'table-level', 'creator_wallets', 'anon', has_table_privilege('anon', 'public.creator_wallets', 'UPDATE')
UNION ALL SELECT 'table-level', 'profiles', 'authenticated', has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
UNION ALL SELECT 'table-level', 'profiles', 'anon', has_table_privilege('anon', 'public.profiles', 'UPDATE')
UNION ALL SELECT 'column: creator_wallets.country', '', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'country', 'UPDATE')
UNION ALL SELECT 'column: wallets.balance', '', 'authenticated', has_column_privilege('authenticated', 'public.wallets', 'balance', 'UPDATE')
UNION ALL SELECT 'column: creator_wallets.payouts_enabled', '', 'authenticated', has_column_privilege('authenticated', 'public.creator_wallets', 'payouts_enabled', 'UPDATE')
UNION ALL SELECT 'column: profiles.stripe_account_id', '', 'authenticated', has_column_privilege('authenticated', 'public.profiles', 'stripe_account_id', 'UPDATE');
```

   Expected if genuinely fixed: every `table-level` row `false`; the
   `wallets.balance`/`creator_wallets.payouts_enabled`/
   `profiles.stripe_account_id` column checks `false`; only
   `creator_wallets.country` `true`.

2. The `pg_default_acl` check (Step 0 of `WALLET_ACCESS_REMEDIATION_PLAN.md`)
   — to know whether `wallets`/`profiles` need a table-level `REVOKE`
   applied (they likely do, by the same logic that explained
   `creator_wallets`, but this hasn't been directly confirmed for them).
3. The full negative-test matrix (`KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md`)
   actually attempted, not just grant-layer inspection — an actual
   `PATCH` request per scenario is the only check that doesn't depend on
   correctly interpreting Postgres ACL semantics.
4. Some elapsed time with a **re-check**, not just one clean result —
   given this exact privilege set has reverted twice already without
   yet knowing why with certainty, one more clean query is not
   sufficient evidence of durability on its own.

## Wallet write-path integrity (unaffected by any of the above)

Independently confirmed, not affected by the reversal: `public.wallet_debit`/
`public.wallet_credit` remain `SECURITY DEFINER`, `service_role`-only
(`REVOKE ALL ... FROM public, anon, authenticated` —
`20260804103153_...sql`, never modified by anything in this session).
This means even during the full-reversal window, a client could forge
`wallets.balance` via a direct `PATCH` (the original KP-01 path) but
could not call `wallet_debit`/`wallet_credit` directly to bypass their
own atomic balance check. This does not reduce KP-01's severity — the
direct-`PATCH` path is precisely what the ineffective `REVOKE` was meant
to close — it only means the exploit surface stayed exactly what it was
before any of this session's fixes, not worse.

## Update 2026-08-24 — actually verified this time

Everything above this section describes the state through the second
silent reversal. Since then: a merge with a parallel Lovable AI session
(`gpt-engineer-app[bot]`) replaced this session's column-level-only
migrations with a materially more complete fix — table-level `REVOKE`
(not column-level) plus RLS policy drops on `wallets`, `creator_wallets`,
and three sibling tables (`creator_wallet_balances`, `creator_payouts`,
`creator_payout_methods`) this session hadn't covered, plus a full
`profiles` column allow-list built from a live `information_schema`
query rather than the partial, deferred list this session's own
remediation plan had left incomplete. Full account in
`PRIVILEGE_DRIFT_INVESTIGATION.md` and the merge commits on
`feature/activation-priority-plan`. **(identified 2026-09-15)**: this is
`supabase/migrations/20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql`
+ `20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
A" in `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`) — the actual, genuinely-
committed migration pair, as distinct from the `20260823160000`/
`20260823170000` filenames named earlier in this document's timeline,
which were never committed to this repo.

A verification query using `has_table_privilege`/`has_column_privilege`
— the actual Postgres functions that govern access decisions, not a
derived `information_schema` view — was run against the live database
covering all 6 relevant tables plus the RPC execute grants. All 20
checks returned exactly the expected value, no exceptions:

| Check | Result |
|---|---|
| `wallets` UPDATE, `authenticated`/`anon` | `false` / `false` |
| `creator_wallets` SELECT `authenticated` / `anon` | `true` / `false` |
| `creator_wallets` UPDATE `authenticated` | `false` |
| `creator_wallet_balances`/`creator_payouts`/`creator_payout_methods` UPDATE `authenticated` | `false` (all three) |
| `profiles.stripe_account_id`/`.stripe_account_status`/`.payment_verified`/`.stripe_customer_id`/`.verification_status` UPDATE `authenticated` | `false` (all five) |
| `profiles.full_name`/`.role` UPDATE `authenticated` | `true` / `true` (intentional) |
| `profiles` INSERT/UPDATE `anon` | `false` / `false` |
| `wallet_debit` EXECUTE `service_role` / `authenticated` | `true` / `false` |
| `accept_application_and_create_studio` EXECUTE `authenticated` | `true` (intentional) |

## Status

**`FIX_APPLIED_AND_VERIFIED`.** All four findings (KP-01, KP-02,
`creator_wallets.stripe_account_id`, `profiles.stripe_account_id`/
`stripe_account_status`) are closed, confirmed by direct query against
live effective privileges, not by a reported-successful statement alone
— the specific gap that produced the two earlier false "fixed"
conclusions in this document.

**Not yet done, and worth doing before treating this as permanently
settled**: an actual negative-test `PATCH` request per
`KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md` (this verification is
grant-layer, which is what governs the outcome, but a real request is
the only check with zero dependency on correctly interpreting Postgres
ACL semantics), and a time-delayed re-check — given this exact privilege
set reverted twice before without an active adversary, purely from two
AI agents applying uncoordinated fixes to the same tables, confirming it
holds after some elapsed time is still worth the five minutes it takes.
