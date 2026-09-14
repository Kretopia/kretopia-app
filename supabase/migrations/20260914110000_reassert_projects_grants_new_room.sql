-- Live bug report (recurrence): "permission denied for table projects" in
-- New Room's createProject() -- the exact same symptom already diagnosed
-- and fixed twice in this repo's history
-- (20260912140000_repair_projects_grants_new_room_regression.sql,
-- 20260913100000_exclude_org_id_from_projects_grant.sql). Both are
-- correct, idempotent SQL -- but this repo has no live DB access from
-- this session, and its own convention (SECURITY_RELEASE_GATE.md's
-- history of "written, NOT yet applied" annotations) is that a migration
-- existing in git is not evidence it ran against production. Given the
-- identical error recurred, the most likely explanation is one or both
-- of those two were never actually applied live.
--
-- Rather than trust that history, this recomputes the correct final
-- state from scratch, fresh against whatever columns actually exist on
-- public.projects right now -- so applying THIS ONE migration alone is
-- sufficient to reach the right state regardless of whether the two
-- above ever ran. Idempotent; safe to run any number of times, including
-- after them.
--
-- `.insert({...}).select().single()` (New Room's exact call shape) needs
-- a working SELECT grant on every column of the row PostgREST returns,
-- immediately after the INSERT, using the same authenticated role --
-- missing or stale SELECT on even one column fails the whole statement
-- with exactly this error, even though the INSERT itself would succeed.
--
-- Policy preserved exactly as already decided twice: client_price,
-- creative_payout, margin_type, margin_value stay fully locked
-- (no SELECT, no UPDATE) -- money fields with their own SECURITY DEFINER
-- write paths. org_id stays SELECT-only (readable, not client-writable)
-- pending a future membership-checked RPC (20260913100000's own reasoning).

GRANT INSERT ON public.projects TO authenticated;

REVOKE SELECT ON public.projects FROM authenticated;
REVOKE UPDATE ON public.projects FROM authenticated;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name NOT IN ('client_price', 'creative_payout', 'margin_type', 'margin_value')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.projects TO authenticated', _col);
    IF _col <> 'org_id' THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.projects TO authenticated', _col);
    END IF;
  END LOOP;
END $$;
