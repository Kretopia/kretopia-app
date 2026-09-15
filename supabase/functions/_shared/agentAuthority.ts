// Shared execution authority for high-stakes, irreversible tools that are
// reachable from more than one door: agent-orchestrator (which enforces the
// 3-tier risk model in orch_tool_registry -- safe_auto / requires_approval /
// locked -- and makes `requires_approval` tools wait for a human tap before
// executeAction() ever runs them), desk-agent (which today calls the same
// underlying edge functions directly and executes immediately, with no
// approval step at all), and the plain human UI (which performs the same
// category of action -- e.g. removing a collaborator, deleting a project --
// through its own direct Supabase calls).
//
// This is NOT a platform-wide unification of every action category (that is
// explicitly out of scope for one pass -- see the PR description). It
// covers the specific tools that call authorizeHighStakesAction() below:
// remove_collaborator and delete_project today. For everything else, the
// existing risk model continues to apply only on the agent-orchestrator
// path, unchanged.
//
// The rule this enforces is narrow and deliberate:
//   - A human acting through the app's own UI on their own account IS their
//     own approval -- we don't force a second "are you sure" beyond what the
//     UI already shows. Those calls are allowed (subject to the tool's own
//     ownership check, which is unchanged) but are now recorded through the
//     same durable ledger as the agent paths, via recordExecutedAction().
//   - An AI agent (desk-agent today) executing one of these tools on the
//     user's behalf, WITHOUT the user ever seeing/approving that specific
//     action, is rejected. It must route through agent-orchestrator's
//     existing propose -> approve -> execute flow instead (reusing the same
//     orch_actions row + AgentApprovalCard UI that already exists), which
//     produces a valid, already-approved agent_action_id this helper will
//     accept.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ActionSource = "agent_orchestrator" | "desk_agent" | "human_ui";

export interface AuthorizeParams {
  admin: SupabaseClient;
  userId: string;
  toolName: string;
  /** How the caller identifies itself. Defaults to "human_ui" when omitted
   * and no agentActionId is supplied -- see module doc. Any caller that IS
   * an autonomous agent MUST pass its real source; misreporting it defeats
   * the point of this check. */
  source?: ActionSource | string | null;
  /** An orch_actions.id the caller claims was already approved via
   * agent-orchestrator's standard flow (agent-orchestrator passes this as
   * `_agent_action_id` when it invokes the underlying handler). */
  agentActionId?: string | null;
}

export type AuthorizeResult =
  | { ok: true; source: ActionSource }
  | { ok: false; status: number; error: string };

/**
 * Gate for the specific high-stakes tools that opt into this shared
 * authority (currently: remove_collaborator, delete_project in
 * copilot-collaborator-tools). Call this BEFORE performing the mutation.
 */
export async function authorizeHighStakesAction(
  params: AuthorizeParams,
): Promise<AuthorizeResult> {
  const { admin, userId, toolName, agentActionId } = params;
  const rawSource = (params.source ?? "").toString().trim();
  const source: ActionSource =
    rawSource === "desk_agent" || rawSource === "agent_orchestrator" || rawSource === "human_ui"
      ? (rawSource as ActionSource)
      : agentActionId
        ? "agent_orchestrator"
        : "human_ui";

  // An already-approved agent_action_id is always sufficient, regardless of
  // the reported source -- it means a human already tapped Approve on this
  // exact action via the standard orch_actions flow.
  if (agentActionId) {
    const { data: action, error } = await admin
      .from("orch_actions")
      .select("id, user_id, tool_name, status")
      .eq("id", agentActionId)
      .maybeSingle();
    if (error || !action) {
      return { ok: false, status: 404, error: "Referenced agent action not found." };
    }
    if (action.user_id !== userId || action.tool_name !== toolName) {
      return { ok: false, status: 403, error: "Approved action does not match this request." };
    }
    if (action.status !== "approved") {
      return {
        ok: false,
        status: 409,
        error: `Action is '${action.status}', not approved -- cannot execute.`,
      };
    }
    return { ok: true, source: "agent_orchestrator" };
  }

  // No pre-approved action. A human acting directly through the app's own
  // UI is allowed (they ARE the approval) -- but an agent claiming to act
  // autonomously on the user's behalf is not: it must propose the action
  // through agent-orchestrator and come back with an approved
  // agent_action_id instead of executing silently.
  if (source === "desk_agent") {
    return {
      ok: false,
      status: 428, // Precondition Required
      error:
        `'${toolName}' requires human approval before it can run. ` +
        "Route this through agent-orchestrator's proposal flow (POST an intent, " +
        "or insert a proposed orch_actions row) and retry with the resulting, " +
        "approved agent_action_id instead of executing it directly.",
    };
  }

  return { ok: true, source };
}

export interface RecordActionParams {
  admin: SupabaseClient;
  userId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  source: ActionSource;
  ok: boolean;
  result?: unknown;
  error?: string | null;
  previewTitle?: string | null;
  previewBody?: string | null;
  agentKind?: string;
  /** Reuse an existing run instead of creating a new one (e.g. desk-agent
   * batching several tool calls from one chat turn into a single run). */
  runId?: string;
}

/**
 * Writes a durable, auditable record of what executed into the SAME
 * orch_runs/orch_actions ledger agent-orchestrator already uses, regardless
 * of which door executed it. Best-effort: a logging failure here must never
 * fail the underlying action, which has already happened by the time this
 * is called.
 */
export async function recordExecutedAction(
  params: RecordActionParams,
): Promise<{ runId: string | null; actionId: string | null }> {
  const { admin, userId, toolName, toolArgs, source, ok, result, error } = params;
  try {
    let runId = params.runId ?? null;
    if (!runId) {
      const { data: run, error: runErr } = await admin
        .from("orch_runs")
        .insert({
          user_id: userId,
          agent_kind: params.agentKind ?? "project_manager",
          intent_text: params.previewTitle ?? toolName,
          intent_classified: `${source} direct execution`,
          context: { source, direct: true },
          status: ok ? "completed" : "failed",
          source,
          model: null,
          tool_call_count: 1,
          tool_names: [toolName],
          summary: params.previewTitle ?? null,
          error: ok ? null : (error ?? null)?.toString().slice(0, 2000) ?? null,
        })
        .select("id")
        .single();
      if (runErr || !run) {
        console.warn("[agentAuthority] failed to create audit run", runErr);
        return { runId: null, actionId: null };
      }
      runId = run.id;
    }

    const { data: action, error: actionErr } = await admin
      .from("orch_actions")
      .insert({
        run_id: runId,
        user_id: userId,
        tool_name: toolName,
        tool_args: toolArgs ?? {},
        risk_level: "requires_approval",
        status: ok ? "executed" : "failed",
        source,
        result: ok ? (result as object | null) ?? null : null,
        error: ok ? null : (error ?? "unknown error"),
        preview_title: params.previewTitle ?? null,
        preview_body: params.previewBody ?? null,
        decided_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (actionErr) {
      console.warn("[agentAuthority] failed to record audit action", actionErr);
      return { runId, actionId: null };
    }
    return { runId, actionId: action?.id ?? null };
  } catch (e) {
    // Audit logging is best-effort -- never let it surface as the caller's error.
    console.warn("[agentAuthority] recordExecutedAction threw", e);
    return { runId: null, actionId: null };
  }
}
