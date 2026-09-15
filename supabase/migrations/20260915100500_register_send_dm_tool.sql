-- Adjacent bug found while auditing the agent-orchestrator approval path
-- (see 20260915100000_agent_action_source_and_receipts.sql): the Talent
-- Copilot "draft_outreach_batch" mode in agent-orchestrator/index.ts has
-- always inserted orch_actions rows with tool_name = 'send_dm' directly
-- (bypassing orch_tool_registry, since it's a bespoke batch-draft mode), but
-- 'send_dm' was never registered in orch_tool_registry. The approval
-- endpoint (POST { action_id, decision }) looks the tool up by tool_name
-- before executing:
--
--   const { data: t } = await admin.from("orch_tool_registry")
--     .select("*").eq("tool_name", action.tool_name).single();
--   if (!t) return 410 "Tool no longer available";
--
-- With no registry row, every approval tap on a Talent Copilot outreach DM
-- has been failing with 410 since this mode shipped. Registering the tool
-- (handler: agent-send-dm, which now also requires this exact approved
-- action id -- see the agent-send-dm gate added alongside this migration)
-- fixes the approval flow itself.
--
-- enabled = false deliberately: agent-orchestrator's own tool-fetch for the
-- planner filters on `enabled = true` (`draft_outreach_batch` inserts these
-- send_dm actions directly, bypassing the planner entirely), while the
-- approval endpoint's tool lookup does not filter on `enabled` at all -- so
-- this row fixes the 410 without also making "send_dm" appear as a tool the
-- planner can spontaneously choose to call (the talent agent already has a
-- distinct `send_message` tool for that, handler send-user-email).
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, handler, args_schema, enabled)
VALUES (
  'send_dm',
  'talent',
  'Send a previously-drafted, user-approved direct message to a creator (Talent Copilot outreach batch only -- not planner-invocable).',
  'requires_approval',
  'agent-send-dm',
  '{"type":"object","properties":{"to_user_id":{"type":"string"},"body":{"type":"string"},"context":{"type":"string"}},"required":["to_user_id","body"]}'::jsonb,
  false
)
ON CONFLICT (tool_name) DO UPDATE
SET agent_kind = EXCLUDED.agent_kind,
    description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    handler = EXCLUDED.handler,
    args_schema = EXCLUDED.args_schema,
    updated_at = now();
