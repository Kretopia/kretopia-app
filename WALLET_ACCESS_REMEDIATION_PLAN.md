# Wallet Access Remediation Plan

Not applied. Prepared for review. Addresses the root cause identified in
`PRIVILEGE_DRIFT_INVESTIGATION.md` §3: a column-level `REVOKE` cannot
override a coexisting table-level `GRANT`, and `creator_wallets` is
confirmed to have had exactly such a table-level grant since its
creation, never revoked by anything in this repo's history. `wallets`
and `profiles` are suspected (not confirmed) to have the equivalent via
Supabase's project-level default privileges.

## Step 0 — confirm before changing anything

Run these first (from `PRIVILEGE_VERIFICATION_QUERIES.sql` §1-2, §5):

```sql
SELECT 'wallets' t, has_table_privilege('authenticated','public.wallets','UPDATE') a, has_table_privilege('anon','public.wallets','UPDATE') an
UNION ALL SELECT 'creator_wallets', has_table_privilege('authenticated','public.creator_wallets','UPDATE'), has_table_privilege('anon','public.creator_wallets','UPDATE')
UNION ALL SELECT 'profiles', has_table_privilege('authenticated','public.profiles','UPDATE'), has_table_privilege('anon','public.profiles','UPDATE');

SELECT pg_get_userbyid(defaclrole), defaclobjtype, defaclacl
FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public';
```

This confirms exactly which tables actually have a table-level grant
(known for certain: `creator_wallets`; suspected, not confirmed:
`wallets`, `profiles`) before deciding which of the steps below are
necessary for each table. Do not apply Step 1 to a table that turns out
not to need it without re-checking — an unnecessary table-level `REVOKE`
+ re-`GRANT` cycle is low-risk but pointless work.

## Step 1 — `public.creator_wallets` (confirmed root cause, apply first)

```sql
-- Remove the table-level grant that made every earlier column-level
-- REVOKE ineffective (source: 20260528125850_...sql:15).
REVOKE UPDATE ON public.creator_wallets FROM authenticated, anon;

-- Re-grant UPDATE only on the columns this migration's own original
-- comment already identified as legitimate self-service fields.
GRANT UPDATE (country, default_currency) ON public.creator_wallets TO authenticated;
```

`kyc_status`, `payouts_enabled`, `charges_enabled`, `stripe_account_id`,
`requirements` are **not** re-granted — their sole write path remains
`service_role` (via `stripe-wallet-webhook`, `create-connect-account`,
`wallet-add-bank`), which already holds `GRANT ALL ... TO service_role`
(`...5850:16`, untouched by this plan).

## Step 2 — `public.wallets`

No column on this table should ever be directly client-writable — the
sole legitimate write path is `wallet_debit`/`wallet_credit`
(`SECURITY DEFINER`, `service_role`-only, confirmed unaffected by
anything in this plan since `SECURITY DEFINER` bypasses grantee-level
privileges entirely).

```sql
REVOKE UPDATE ON public.wallets FROM authenticated, anon;
-- No re-grant — zero columns need direct client UPDATE access.
```

Apply this even if Step 0 doesn't confirm a table-level grant exists
today, since it's a correct, zero-downside hardening either way (removes
a privilege that should never be needed, closes the exact gap this
whole investigation is about if the default-privileges hypothesis is
correct).

## Step 3 — `public.profiles` (needs a product decision, not just a security one)

`profiles` has dozens of columns, most of which genuinely need to stay
self-editable (`full_name`, `bio`, `avatar_url`, and many more — this
repo was not fully enumerated for this plan, since deciding the complete
legitimate-edit list for a user's own profile is a product-scope
question, not a security-only one, and doing it hastily risks silently
breaking real profile-editing functionality across the app).

**What this plan can say with confidence**: the following columns should
**not** be included in any re-grant, regardless of what the full
allow-list ends up being — each is either the specific finding from this
investigation or was already judged sensitive enough to have its
`SELECT` access revoked in a prior session (`20260804103153_...sql:16`),
and none of them are values a user should ever set on themselves via a
raw `UPDATE`:

```
stripe_account_id, stripe_account_status,   -- this investigation's finding
stripe_customer_id, stripe_subscription_id, -- Stripe-system-controlled
payment_verified,                           -- system-verified flag
phone_number, date_of_birth                 -- PII already SELECT-restricted
```

(`hourly_rate`/`project_rate` were also SELECT-restricted in that same
migration, but for a different reason — hiding a rate from other users'
view, not because the user shouldn't be able to set their own rate. They
are **not** included in the exclusion list above; a user should likely
still be able to `UPDATE` their own rate.)

**Recommended sequence, once someone with product context can produce
the full column list**:

```sql
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (<every legitimate self-editable column, explicitly enumerated>)
  ON public.profiles TO authenticated;
```

**Do not skip straight to this without the full list** — an incomplete
allow-list will silently break real user-facing profile editing
(`ProfileEdit`-style flows, company-profile editing, etc.) across the
app, which is a functional regression, not a security one, but a real
one. Until that list exists, the narrower fix already applied this
session (`REVOKE UPDATE (stripe_account_id, stripe_account_status) ...`,
`20260823170000_...sql:72`) is the safest available partial mitigation
for `profiles` specifically — it does not address the table-level-grant
root cause (§3 of the investigation) if one exists for `profiles`, but
it is not wrong to have applied, and removing it would not help.
*(corrected 2026-09-15: `20260823170000_krepay_security_hardening_followup.sql`
was never actually committed to `supabase/migrations/` in this repo —
confirmed absent from `git log --all`; it only ever existed as a SQL
block quoted inline in `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`. This entire
plan was superseded by a genuinely-committed pair of migrations,
`20260823223419_43def0af-be27-4a94-892e-2e8b0ad37eef.sql` +
`20260823223514_222e9e03-bb14-4fa5-b270-d3463f77d476.sql` ("Migration
A"), which drops the permissive RLS policies outright and was
independently confirmed closed — see `KREPAY_CRITICAL_SECURITY_RUNBOOK.md`
and `WALLET_SECURITY_VERIFICATION_REPORT.md`. The steps below are left
intact for historical record; do not follow them as a live action item.)*

## Step 4 — post-migration verification (all three tables)

Re-run `PRIVILEGE_VERIFICATION_QUERIES.sql` §1-4 in full. Expect:

- §1 (`has_table_privilege`, table-level): `false` for `authenticated`
  and `anon` on all three tables.
- §2 (`information_schema.role_table_grants`): zero rows for `UPDATE` +
  `authenticated`/`anon`/`PUBLIC` on any of the three tables.
- §3 (`information_schema.column_privileges`, `UPDATE` only): zero rows
  for `wallets.balance`/`credits`, `creator_wallets`'s five sensitive
  columns, `profiles.stripe_account_id`/`stripe_account_status`. For
  `creator_wallets.country`/`default_currency`, **expect a row** —
  that's the intentional re-grant from Step 1, not a regression.
- §4 (raw `relacl`/`attacl`): no `w` (UPDATE) for `authenticated`/`anon`
  in `pg_class.relacl` for any of the three tables' table-level ACL; any
  column-level `attacl` entries should match exactly what Step 1-3
  intentionally granted, nothing more.

Also re-run the negative-test matrix (`KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md`)
in full — grant-level verification alone was exactly what gave false
confidence in the previous session (checks passed, then a later check
found everything reverted); an actual attempted `PATCH` against each
column is the higher-confidence check.

## Step 5 — detect a future recurrence, don't just hope it doesn't happen again

Two independent options, not mutually exclusive:

**A. Postgres event trigger (real-time, catches the exact moment it
happens)**:

```sql
CREATE OR REPLACE FUNCTION public.log_grant_revoke_on_sensitive_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  obj RECORD;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF obj.object_identity IN (
      'public.wallets', 'public.creator_wallets', 'public.profiles'
    ) THEN
      INSERT INTO public.privilege_change_audit_log (object_identity, command_tag, occurred_at)
      VALUES (obj.object_identity, obj.command_tag, now());
    END IF;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER trg_log_grant_revoke
  ON ddl_command_end
  WHEN TAG IN ('GRANT', 'REVOKE')
  EXECUTE FUNCTION public.log_grant_revoke_on_sensitive_tables();
```

(Requires creating `public.privilege_change_audit_log` first —
`id uuid default gen_random_uuid() primary key, object_identity text,
command_tag text, occurred_at timestamptz`. Event triggers require
superuser or a role with `CREATE` on the database in most Postgres
setups — confirm this is permitted on a Supabase/Lovable-managed
instance before relying on it; some managed platforms restrict event
triggers. Not confirmed for this project.)

**B. Scheduled re-check (simpler, works on any platform, higher latency)**:
if `pg_cron` (or an external scheduler hitting a `SECURITY DEFINER`
function) is available, schedule Step 4's verification queries to run
periodically (e.g. hourly) and write their result to a log table or
raise a notice/alert on any non-empty result. Lower engineering cost
than option A, but only as good as the check interval — a several-hour
window is unavoidable if it revokes-then-reverts between checks.

Whichever is used, the goal is the same: the next time this happens,
there should be a timestamped record of exactly when, rather than
discovering it only by manually re-running a verification query and
noticing a difference, as happened this session.
