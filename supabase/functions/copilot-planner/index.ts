// Thrive Copilot — Planner
// Decomposes a multi-step user goal into an ordered plan of tool calls.
// Returns plan_id; the UI renders a PlanCard and the user taps Approve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadCopilotContext, renderContextPreamble } from "../_shared/copilotContext.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimErr } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimErr || !userId) return json({ error: "Invalid session" }, 401);

    const rateLimit = await checkAiFeatureRateLimit(admin, userId, "copilot-planner");
    if (!rateLimit.allowed) return rateLimit.response;

    const body = await req.json().catch(() => ({}));
    const goal: string = String(body.goal ?? "").trim();
    const projectId: string | null = body.project_id ?? null;
    const surface: string = body.surface ?? "desk";
    if (!goal || goal.length < 4) return json({ error: "goal required" }, 400);

    // Load tool catalog from registry — these are the only tools the planner can use
    const { data: tools } = await admin
      .from("orch_tool_registry")
      .select("tool_name, agent_kind, description, risk_level, handler, args_schema")
      .eq("enabled", true);
    const catalog = (tools ?? []).map((t: any) => ({
      name: t.tool_name,
      kind: t.agent_kind,
      desc: t.description,
      risk: t.risk_level ?? "safe_auto",
      handler: t.handler ?? null,
      schema: t.args_schema ?? null,
    }));

    // Load user + project facts
    const ctx = await loadCopilotContext(admin, userId).catch(() => null);
    const preamble = ctx ? renderContextPreamble(ctx, surface, { project_id: projectId ?? undefined }) : "";

    let projectFacts = "";
    if (projectId) {
      const { data: p } = await admin
        .from("projects")
        .select("id, title, status, deadline, description")
        .eq("id", projectId)
        .single();
      const { data: tasks } = await admin
        .from("project_tasks")
        .select("id, title, status, due_date")
        .eq("project_id", projectId)
        .neq("status", "done")
        .limit(20);
      projectFacts = `\nACTIVE PROJECT: "${p?.title}" · status ${p?.status} · deadline ${p?.deadline || "n/a"}\nOpen tasks: ${(tasks ?? []).length}\n`;
    }

    const systemPrompt = `You are the Thrive Copilot Planner. The user gave you a multi-step goal. Your job is to decompose it into an ordered plan of 2-8 concrete tool calls.

${preamble}${projectFacts}

AVAILABLE TOOLS (you may ONLY plan with these — never invent tools):
${catalog.map((t) => `- ${t.name} [${t.kind}, ${t.risk}]: ${t.desc}\n  args_schema: ${JSON.stringify(t.schema ?? {})}`).join("\n")}

PLANNING RULES:
1. Each step MUST reference a tool from the catalog above by exact tool_name.
2. Steps run in order. Later steps can reference earlier step outputs with {{step_N.field}} placeholders (e.g. {{step_1.user_id}} after a find_user step).
3. If the goal requires a person → first step is find_user.
4. If the goal mentions a project by name (not "this") → first step is list_my_projects, then resolve.
5. Keep ARGS minimal but valid for the tool's args_schema. Include project_id when a tool accepts it and a project is known.
6. If a step creates a new project, follow-up project tools should use {{step_N.project_id}} where N is the create_project step.
7. If the user asks to create a project and add tasks, step 1 should be create_project, then create_task steps using {{step_1.project_id}}.
8. Each step needs a short human-readable "label" (max 60 chars, present tense, no emoji) and "rationale" (1 sentence, why this step).
9. If the goal is single-step or unclear → return an empty steps array and put the explanation in "summary".
10. Never plan tools at risk_level "destructive" without strong evidence the user wants it.
11. For draft_invoice, include amount, currency when stated, notes/description, and project_id when available. Do not use a generic "message" arg for draft_invoice.
12. For generate_milestones, include action: "generate_milestones" and project_id; for analyze_brief include action: "analyze_brief".

Return ONLY this JSON shape (no prose, no fences):
{
  "summary": "1-line plain-English summary of what will happen",
  "steps": [
    { "tool_name": "find_user", "label": "Find Rene Auguste in your network", "rationale": "Need user_id before adding", "args": { "name_query": "Rene Auguste" } },
    { "tool_name": "add_collaborator", "label": "Add Rene to Content for ThriveIN", "rationale": "Owner approved invite", "args": { "user_id_to_add": "{{step_1.user_id}}", "target_project_id": "${projectId ?? ""}", "role": "collaborator" } }
  ]
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: goal },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
    if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("planner AI error", aiResp.status, txt);
      return json({ error: "Planner failed" }, 500);
    }

    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; steps?: any[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("planner JSON parse failed", raw);
      return json({ error: "Planner returned invalid JSON" }, 500);
    }

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    if (!steps.length) {
      return json({
        ok: true,
        plan_id: null,
        summary: parsed.summary ?? "Nothing to plan — try being more specific.",
        steps: [],
      });
    }

    // Validate each step references a real tool
    const toolByName = new Map(catalog.map((t) => [t.name, t]));
    const validSteps = steps
      .filter((s) => s && typeof s.tool_name === "string" && toolByName.has(s.tool_name))
      .slice(0, 8)
      .map((s, idx) => ({
        index: idx + 1,
        tool_name: s.tool_name,
        label: String(s.label ?? s.tool_name).slice(0, 80),
        rationale: String(s.rationale ?? "").slice(0, 200),
        args: s.args ?? {},
        agent_kind: toolByName.get(s.tool_name)!.kind,
        handler: (toolByName.get(s.tool_name) as any).handler ?? null,
        status: "pending",
        result: null,
      }));

    if (!validSteps.length) {
      return json({
        ok: true,
        plan_id: null,
        summary: "I drafted a plan but none of the steps mapped to known tools. Try rephrasing.",
        steps: [],
      });
    }

    // Persist the plan
    const { data: plan, error: insertErr } = await admin
      .from("copilot_plans")
      .insert({
        user_id: userId,
        project_id: projectId,
        goal,
        surface,
        status: "proposed",
        steps: validSteps,
        summary: parsed.summary ?? null,
      })
      .select("id, goal, summary, steps, status")
      .single();

    if (insertErr) throw insertErr;

    return json({ ok: true, plan_id: plan.id, ...plan });
  } catch (e) {
    console.error("copilot-planner error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
