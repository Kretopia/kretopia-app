// Copilot collaborator tools — exposed to agent-orchestrator for project_manager intents.
// Tools: find_user, list_my_projects, add_collaborator, remove_collaborator
//
// All tools run under the caller's JWT so RLS + project ownership rules apply.
// Service role is used for cross-table reads (public_profiles_safe, system messages).
//
// remove_collaborator and delete_project are the two highest-stakes,
// irreversible actions this function exposes (revoking access / destroying
// a project), and they are reachable from three doors: agent-orchestrator
// (which gates them behind its requires_approval flow before ever calling
// this function), desk-agent (which previously called them directly with
// zero gating), and the human UI (project settings / member management,
// which now also calls this function instead of mutating tables directly,
// so the same ownership check + audit trail applies everywhere). See
// _shared/agentAuthority.ts for the shared rule these two tools enforce.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeHighStakesAction, recordExecutedAction } from "../_shared/agentAuthority.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type ToolName =
  | "find_user"
  | "list_my_projects"
  | "add_collaborator"
  | "remove_collaborator"
  | "archive_project"
  | "delete_project";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    // The orchestrator passes the tool name in `_tool` (we'll register one
    // shared handler for all four tools). Fall back to inferring from args.
    const tool = (body._tool as ToolName) ||
      (body.project_id && body.user_id_to_add ? "add_collaborator" :
       body.project_id && body.user_id_to_remove ? "remove_collaborator" :
       body.name_query ? "find_user" : "list_my_projects");

    switch (tool) {
      case "find_user":
        return await findUser(user.id, body);
      case "list_my_projects":
        return await listMyProjects(user.id);
      case "add_collaborator":
        return await addCollaborator(user.id, body);
      case "remove_collaborator":
        return await removeCollaborator(user.id, body);
      case "archive_project":
        return await archiveProject(user.id, body);
      case "delete_project":
        return await deleteProject(user.id, body);
      default:
        return json({ error: `Unknown tool: ${tool}` }, 400);
    }
  } catch (e) {
    console.error("copilot-collaborator-tools error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ---- Tool: find_user ----
// Resolve a spoken/typed name to one or more candidate profiles. Prefers the
// caller's accepted connections (highest precision), then falls back to
// public_profiles_safe by full_name ILIKE.
async function findUser(userId: string, body: any) {
  const q = String(body.name_query ?? body.query ?? "").trim();
  if (!q || q.length < 2) {
    return json({ ok: false, error: "name_query must be at least 2 characters" }, 400);
  }
  const like = `%${q}%`;

  // 1. Connections-first lookup
  const { data: conns } = await admin
    .from("connections")
    .select("connected_user_id, user_id, status")
    .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`)
    .eq("status", "accepted");

  const peerIds = (conns ?? [])
    .map((c: any) => (c.user_id === userId ? c.connected_user_id : c.user_id))
    .filter(Boolean);

  // Widen SELECT so the planner has enough to disambiguate AND to build a rich
  // approval-card preview (avatar + role + username + location).
  // Only columns actually exposed by public_profiles_safe — adding unknown
  // columns silently returns 0 rows.
  const SELECT_COLS = "user_id, full_name, username, role, avatar_url, location";

  let connMatches: any[] = [];
  if (peerIds.length) {
    // Match on full_name OR username so "@dezii" works the same as "Dezii".
    const { data: byName } = await admin
      .from("public_profiles_safe")
      .select(SELECT_COLS)
      .in("user_id", peerIds)
      .or(`full_name.ilike.${like},username.ilike.${like}`)
      .limit(5);
    connMatches = (byName ?? []).map((p: any) => ({ ...p, source: "connection" }));
  }

  let publicMatches: any[] = [];
  if (connMatches.length < 3) {
    const { data } = await admin
      .from("public_profiles_safe")
      .select(SELECT_COLS)
      .or(`full_name.ilike.${like},username.ilike.${like}`)
      .neq("user_id", userId)
      .limit(5);
    publicMatches = (data ?? [])
      .filter((p: any) => !connMatches.some((c) => c.user_id === p.user_id))
      .map((p: any) => ({ ...p, source: "public" }));
  }

  const matches = [...connMatches, ...publicMatches].slice(0, 5);
  return json({
    ok: true,
    query: q,
    match_count: matches.length,
    matches,
    needs_clarification: matches.length === 0 || matches.length > 1,
  });
}

// ---- Tool: list_my_projects ----
// Returns the caller's active projects with role + last activity, used for
// disambiguating "the X project" references.
async function listMyProjects(userId: string) {
  const { data: owned } = await admin
    .from("projects")
    .select("id, title, status, updated_at, workspace_type")
    .eq("created_by", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(20);

  const { data: collabRows } = await admin
    .from("project_collaborators")
    .select("project_id, role, status")
    .eq("user_id", userId)
    .eq("status", "accepted");

  const collabIds = (collabRows ?? []).map((r: any) => r.project_id);
  let collabProjects: any[] = [];
  if (collabIds.length) {
    const { data } = await admin
      .from("projects")
      .select("id, title, status, updated_at, workspace_type")
      .in("id", collabIds)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(20);
    collabProjects = data ?? [];
  }

  const ownedSet = new Set((owned ?? []).map((p: any) => p.id));
  const merged = [
    ...(owned ?? []).map((p: any) => ({ ...p, my_role: "owner" })),
    ...collabProjects
      .filter((p: any) => !ownedSet.has(p.id))
      .map((p: any) => {
        const r = (collabRows ?? []).find((c: any) => c.project_id === p.id);
        return { ...p, my_role: r?.role ?? "member" };
      }),
  ];

  return json({ ok: true, project_count: merged.length, projects: merged });
}

// ---- Tool: add_collaborator ----
// Inserts an accepted project_collaborators row, posts a system message in the
// project chat, and creates a notification. Owner-only.
async function addCollaborator(userId: string, body: any) {
  const projectId = String(body.project_id ?? body.target_project_id ?? "");
  const newUserId = String(body.user_id_to_add ?? body.user_id ?? "");
  const role = String(body.role ?? "member").toLowerCase();
  const allowedRoles = ["member", "creative", "client", "collaborator"];
  const finalRole = allowedRoles.includes(role) ? role : "member";

  if (!projectId || !newUserId) {
    return json({ ok: false, error: "project_id and user_id_to_add are required" }, 400);
  }

  // Ownership / admin check
  const { data: project, error: projErr } = await admin
    .from("projects")
    .select("id, title, created_by")
    .eq("id", projectId)
    .single();
  if (projErr || !project) return json({ ok: false, error: "Project not found" }, 404);
  if (project.created_by !== userId) {
    return json({ ok: false, error: "Only the project owner can add collaborators." }, 403);
  }

  // Don't add self / duplicates
  if (newUserId === userId) {
    return json({ ok: false, error: "You're already on this project." }, 400);
  }

  // Validate the target actually has an auth.users row (FK target).
  // Falls back to a name lookup if the LLM passed something invalid — but
  // refuses if the fallback is ambiguous (2+ matches), so we never silently
  // add the wrong person.
  let resolvedUserId = newUserId;
  try {
    const { data: authLookup, error: authErr } = await admin.auth.admin.getUserById(newUserId);
    if (authErr || !authLookup?.user) {
      const hint = String(body.invitee_name ?? body.name_query ?? body.name ?? "").trim();
      if (hint.length >= 2) {
        const like = `%${hint}%`;
        const { data: candidates } = await admin
          .from("profiles")
          .select("user_id, full_name, username, is_claimed")
          .or(`full_name.ilike.${like},username.ilike.${like}`)
          .eq("is_claimed", true)
          .limit(3);
        const list = candidates ?? [];
        if (list.length === 0) {
          return json({ ok: false, error: `I couldn't find a claimed account for "${hint}". They may need to sign up first.` }, 400);
        }
        if (list.length > 1) {
          return json({
            ok: false,
            needs_clarification: true,
            error: `Multiple people match "${hint}" — ask the user which one (${list.map((c: any) => c.full_name ?? c.username).join(", ")}).`,
            candidates: list,
          }, 409);
        }
        resolvedUserId = list[0].user_id;
      } else {
        return json({ ok: false, error: "That user account doesn't exist yet. Ask them to sign up, then try again." }, 400);
      }
    }
  } catch (e) {
    console.error("auth.users lookup failed", e);
    return json({ ok: false, error: "Couldn't verify that user account." }, 500);
  }

  const { data: existing } = await admin
    .from("project_collaborators")
    .select("id, status, role")
    .eq("project_id", projectId)
    .eq("user_id", resolvedUserId)
    .maybeSingle();
  if (existing) {
    return json({
      ok: true,
      already_member: true,
      message: `Already on this project (${existing.status}).`,
    });
  }

  // Resolve invitee name + avatar for the chat message and any downstream UI
  const { data: invitee } = await admin
    .from("public_profiles_safe")
    .select("full_name, avatar_url, username, role")
    .eq("user_id", resolvedUserId)
    .maybeSingle();
  const inviteeName = invitee?.full_name ?? "New collaborator";

  // Insert as ACCEPTED (Auto-Accept pattern from Projects Workspace memory)
  const { data: row, error: insErr } = await admin
    .from("project_collaborators")
    .insert({
      project_id: projectId,
      user_id: resolvedUserId,
      role: finalRole,
      status: "accepted",
      invited_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .select("id, role, status")
    .single();
  if (insErr) return json({ ok: false, error: insErr.message }, 500);

  // Post a system message in project chat (best-effort; don't fail the add)
  try {
    await admin.from("project_messages").insert({
      project_id: projectId,
      user_id: userId,
      message: `${inviteeName} just joined the project.`,
    });
  } catch (e) {
    console.warn("system message insert failed", e);
  }

  // Notification (best-effort)
  try {
    await admin.from("notifications").insert({
      user_id: resolvedUserId,
      type: "project_invite",
      title: `Added to "${project.title}"`,
      message: `You've been added to a project as ${finalRole}.`,
      action_url: `/desk/${projectId}`,
    });
  } catch (e) {
    console.warn("notification insert failed", e);
  }

  return json({
    ok: true,
    collaborator_id: row.id,
    project_id: projectId,
    project_title: project.title,
    invitee_name: inviteeName,
    invitee_user_id: resolvedUserId,
    invitee_avatar_url: (invitee as any)?.avatar_url ?? null,
    invitee_username: (invitee as any)?.username ?? null,
    invitee_role: (invitee as any)?.role ?? null,
    role: row.role,
  });
}

// ---- Tool: remove_collaborator ----
async function removeCollaborator(userId: string, body: any) {
  const projectId = String(body.project_id ?? body.target_project_id ?? "");
  const removeUserId = String(body.user_id_to_remove ?? body.user_id ?? "");
  if (!projectId || !removeUserId) {
    return json({ ok: false, error: "project_id and user_id_to_remove required" }, 400);
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, title, created_by")
    .eq("id", projectId)
    .single();
  if (!project) return json({ ok: false, error: "Project not found" }, 404);
  if (project.created_by !== userId) {
    return json({ ok: false, error: "Only the project owner can remove collaborators." }, 403);
  }

  // Shared authority check -- see _shared/agentAuthority.ts. A human acting
  // through the app's own UI (or an already-approved agent-orchestrator
  // action) proceeds; an agent (desk-agent) calling this directly without a
  // prior approval is rejected here instead of silently removing access.
  const authz = await authorizeHighStakesAction({
    admin,
    userId,
    toolName: "remove_collaborator",
    source: body._source,
    agentActionId: body._agent_action_id,
  });
  if (!authz.ok) return json({ ok: false, error: authz.error }, authz.status);

  const { data: invitee } = await admin
    .from("public_profiles_safe")
    .select("full_name")
    .eq("user_id", removeUserId)
    .maybeSingle();

  const { error } = await admin
    .from("project_collaborators")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", removeUserId);
  if (error) {
    await recordExecutedAction({
      admin, userId, toolName: "remove_collaborator", toolArgs: body, source: authz.source,
      ok: false, error: error.message, previewTitle: `Remove collaborator from "${project.title}"`,
    });
    return json({ ok: false, error: error.message }, 500);
  }

  await recordExecutedAction({
    admin, userId, toolName: "remove_collaborator", toolArgs: body, source: authz.source,
    ok: true, result: { project_id: projectId, removed_user_id: removeUserId },
    previewTitle: `Remove ${invitee?.full_name ?? "collaborator"} from "${project.title}"`,
  });

  return json({
    ok: true,
    project_title: project.title,
    removed_name: invitee?.full_name ?? "Collaborator",
  });
}

// ---- Tool: archive_project ----
// Soft hide: sets projects.status = 'archived'. Owner-only. Reversible.
async function archiveProject(userId: string, body: any) {
  const projectId = String(body.project_id ?? body.target_project_id ?? "");
  if (!projectId) return json({ ok: false, error: "project_id is required" }, 400);

  const { data: project } = await admin
    .from("projects")
    .select("id, title, created_by, status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return json({ ok: false, error: "Project not found" }, 404);
  if (project.created_by !== userId) {
    return json({ ok: false, error: "Only the project owner can archive this project." }, 403);
  }
  if (project.status === "archived") {
    return json({ ok: true, already_archived: true, project_title: project.title });
  }

  const { error } = await admin
    .from("projects")
    .update({ status: "archived" })
    .eq("id", projectId);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, project_id: projectId, project_title: project.title, status: "archived" });
}

// ---- Tool: delete_project ----
// Hard delete. Owner-only. Destructive — agent must surface this as
// requires_approval and the orchestrator preview must spell out the project title.
async function deleteProject(userId: string, body: any) {
  const projectId = String(body.project_id ?? body.target_project_id ?? "");
  if (!projectId) return json({ ok: false, error: "project_id is required" }, 400);

  const { data: project } = await admin
    .from("projects")
    .select("id, title, created_by")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return json({ ok: false, error: "Project not found" }, 404);
  if (project.created_by !== userId) {
    return json({ ok: false, error: "Only the project owner can delete this project." }, 403);
  }

  // Shared authority check -- see _shared/agentAuthority.ts and the
  // remove_collaborator comment above. Permanent deletion is the single
  // highest-blast-radius action this function exposes.
  const authz = await authorizeHighStakesAction({
    admin,
    userId,
    toolName: "delete_project",
    source: body._source,
    agentActionId: body._agent_action_id,
  });
  if (!authz.ok) return json({ ok: false, error: authz.error }, authz.status);

  // project_tasks/milestones/time_entries/project_files/project_messages/
  // project_collaborators all FK to projects(id) ON DELETE CASCADE, so
  // deleting the project row is sufficient -- but child rows are still
  // useful to have queried/logged here for the audit trail below, and this
  // keeps a single, DB-cascade-driven deletion path shared by every caller
  // (this function is now also what the human-UI "Delete project" flow
  // calls, instead of duplicating the cascade client-side).
  const { error } = await admin
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("created_by", userId);
  if (error) {
    await recordExecutedAction({
      admin, userId, toolName: "delete_project", toolArgs: body, source: authz.source,
      ok: false, error: error.message, previewTitle: `Delete "${project.title}"`,
    });
    return json({
      ok: false,
      error: `Couldn't delete "${project.title}": ${error.message}. Try archiving instead.`,
    }, 500);
  }

  await recordExecutedAction({
    admin, userId, toolName: "delete_project", toolArgs: body, source: authz.source,
    ok: true, result: { project_id: projectId, deleted: true },
    previewTitle: `Delete "${project.title}"`,
    previewBody: `"${project.title}" and all its tasks, files and chat were permanently deleted.`,
  });

  return json({ ok: true, project_id: projectId, project_title: project.title, deleted: true });
}
