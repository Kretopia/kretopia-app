-- "Bible" item: durable AgentRun state machine. Audit of orch_runs/orch_actions
-- (agent-orchestrator/index.ts) found the run's mid-plan state lives only in
-- an in-memory JS array for up to ~110s (MAX_TURNS=3 x 45s + headroom under
-- the 150s edge function ceiling) -- nothing is written to orch_runs between
-- the initial INSERT (status='running') and the final UPDATE. If the process
-- is killed anywhere in between (platform timeout, OOM, network drop before
-- the response completes), the row is never revisited by anything and stays
-- 'running' forever. True mid-run resumability (checkpointing every planner
-- turn so a second invocation could pick up where a killed one left off) is
-- a much larger architecture change and out of scope here; what this closes
-- is the narrower, concretely-confirmed bug: a run that can never reach a
-- terminal state, and the equivalent case on the orch_actions side (a claimed
-- action stuck at 'approved' if the process dies between executeAction()
-- resolving and the row being updated to its final status).
--
-- Two layers:
--   1. agent-orchestrator's own catch block (see the edge function diff in
--      this same PR) now fails the run immediately for any caught exception
--      -- covers the common case (AI gateway error, DB write failure, etc.)
--      the instant it happens.
--   2. This function is the backstop for the case (1) can't cover: the
--      process is killed outright, skipping every line of JS including the
--      catch block. Nothing else will ever look at that row again unless
--      something proactively sweeps for staleness.

CREATE OR REPLACE FUNCTION public.reconcile_stale_orch_runs(_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run_message TEXT := 'Run did not complete within the expected time and was reconciled automatically.';
  _action_message TEXT := 'Action was approved but never finished executing and was reconciled automatically.';
  _orphan_message TEXT := 'Parent run did not complete and was reconciled automatically.';
  _run_count INTEGER;
BEGIN
  -- A run past 5 minutes since its last update is unambiguously stuck: the
  -- planner's own budget is ~110s and the edge function's hard ceiling is
  -- 150s, so 5 minutes is a wide margin, not a race against a genuinely
  -- slow-but-progressing request.
  UPDATE public.orch_runs
     SET status = 'failed', error = _run_message, updated_at = now()
   WHERE status IN ('pending', 'running')
     AND updated_at < now() - INTERVAL '5 minutes'
     AND (_user_id IS NULL OR user_id = _user_id);
  GET DIAGNOSTICS _run_count = ROW_COUNT;

  -- Actions still 'proposed' under a run that just got reconciled as failed
  -- are orphaned -- the run that would have executed or timed them out is
  -- gone, so nothing will ever decide them. Reject rather than leave them
  -- sitting in a pending-approval list for an action whose context no
  -- longer exists.
  IF _run_count > 0 THEN
    UPDATE public.orch_actions a
       SET status = 'rejected', decided_at = now(), error = _orphan_message
      FROM public.orch_runs r
     WHERE a.run_id = r.id
       AND a.status = 'proposed'
       AND r.status = 'failed'
       AND r.error = _run_message
       AND r.updated_at >= now() - INTERVAL '1 minute';
  END IF;

  -- Separately: an action can reach 'approved' (the approval endpoint's
  -- compare-and-swap claim) and then never reach a terminal status if the
  -- process is killed between executeAction() resolving and the row being
  -- updated -- a much smaller window than the run case, but the same bug
  -- class. proposed_at is the only timestamp guaranteed set from creation;
  -- decided_at is set at the moment of the claim, so use that here.
  UPDATE public.orch_actions
     SET status = 'failed', error = _action_message, executed_at = now()
   WHERE status = 'approved'
     AND decided_at < now() - INTERVAL '5 minutes'
     AND (_user_id IS NULL OR user_id = _user_id);

  RETURN _run_count;
END;
$$;

-- Callable only by trusted server-side code (edge functions via the
-- service-role client, or a cron job run as an elevated role) -- there's no
-- legitimate reason for an end user to reconcile runs directly, and an
-- unrestricted _user_id parameter would let one user force-fail another's
-- in-flight run if this were reachable as `authenticated` (bounded damage
-- since it only touches rows already stale for 5+ minutes, but there's no
-- reason to allow it at all).
REVOKE ALL ON FUNCTION public.reconcile_stale_orch_runs(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_orch_runs(UUID) TO service_role;

-- Proactive global sweep, independent of any particular user opening the
-- app again. Not run here -- pg_cron scheduling in this project has always
-- been applied out-of-band via the SQL editor rather than through a
-- migration (see 'process-email-queue' in
-- 20260413000526_email_infra.sql), same reasoning applies here. To enable:
--   SELECT cron.schedule('reconcile-stale-orch-runs', '*/5 * * * *',
--     $$SELECT public.reconcile_stale_orch_runs();$$);
-- To revert: SELECT cron.unschedule('reconcile-stale-orch-runs');
--
-- Until that's applied, agent-orchestrator/index.ts calls this function
-- (scoped to the calling user) at the top of every new-run request, so a
-- user's own stuck runs self-heal the next time they use the feature even
-- without the cron job.
