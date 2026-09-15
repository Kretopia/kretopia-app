-- "One authority, two doors" + receipts foundation.
--
-- Part 1 -- execution source. orch_runs/orch_actions is the closest thing
-- this codebase has to a real state machine for AI-agent actions (3-tier
-- risk model: safe_auto / requires_approval / locked), but today it only
-- ever gets written to by agent-orchestrator's own request handler. Other
-- doors that perform the exact same tool calls -- desk-agent (which calls
-- copilot-collaborator-tools directly with zero approval gating) and the
-- human UI (which mutates project_collaborators/projects straight from the
-- client) -- never touch this table at all, so there is no single place
-- that records "what actually ran," regardless of which door it came
-- through. `source` lets the same ledger be used by all of them.
--
-- Part 2 -- receipts. orch_runs already has tokens_used/latency_ms columns
-- (see 20260501201445) but nothing has ever written to tokens_used -- the
-- schema anticipated cost-visibility and the code never followed through.
-- This adds the remaining minimal fields (model, tool call count/names) so
-- a receipt -- "which model, how long, what ran, what happened" -- can
-- actually be reconstructed per run. This is infrastructure only: no caps,
-- no pricing, no user-facing display. Just making sure the data exists and
-- is captured going forward.

ALTER TABLE public.orch_runs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent_orchestrator',
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS tool_call_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tool_names TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.orch_actions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent_orchestrator';

DO $$ BEGIN
  ALTER TABLE public.orch_runs
    ADD CONSTRAINT orch_runs_source_check
    CHECK (source IN ('agent_orchestrator', 'desk_agent'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orch_actions
    ADD CONSTRAINT orch_actions_source_check
    CHECK (source IN ('agent_orchestrator', 'desk_agent', 'human_ui'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.orch_runs.source IS
  'Which execution door created this run: agent_orchestrator (the AI-agent orchestrator with full risk-tier gating) or desk_agent (ThriveDesk''s project-scoped operator). Lets one ledger cover both instead of desk_agent turns going unrecorded.';
COMMENT ON COLUMN public.orch_runs.tokens_used IS
  'Total tokens (prompt+completion) reported by the AI gateway for this run. Receipt data -- foundation for future cost/credit visibility, not yet surfaced in any UI. Was defined in the original schema but never populated until this pass.';
COMMENT ON COLUMN public.orch_runs.model IS
  'Model id used for this run''s primary AI call(s), e.g. google/gemini-3-flash-preview.';
COMMENT ON COLUMN public.orch_runs.tool_call_count IS
  'How many tool calls (safe_auto + requires_approval + locked) the model proposed/ran during this run.';
COMMENT ON COLUMN public.orch_runs.tool_names IS
  'Distinct tool_name values invoked during this run, for a future per-run receipt breakdown.';
COMMENT ON COLUMN public.orch_actions.source IS
  'Which door executed this action: agent_orchestrator (via the standard proposed -> approved -> executed flow), desk_agent (ThriveDesk chat), or human_ui (a direct, self-service action a signed-in user took through the app''s own UI, routed through the same shared authorization/audit helper as the agent paths for the specific high-stakes tools that require it -- see supabase/functions/_shared/agentAuthority.ts).';

CREATE INDEX IF NOT EXISTS idx_orch_actions_source ON public.orch_actions(source);
CREATE INDEX IF NOT EXISTS idx_orch_runs_source ON public.orch_runs(source);
