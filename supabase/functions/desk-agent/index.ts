// Thrive Agent — project operator with intent classification, confidence-gated
// tool calling, and conversational memory.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadCopilotContext, renderContextPreamble } from "../_shared/copilotContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_DAILY_LIMIT = 20;

type ToolName =
  | "create_task"
  | "mark_task_done"
  | "send_message_to_collaborator"
  | "get_project_summary"
  | "schedule_reminder"
  | "draft_invoice"
  | "draft_quote"
  | "start_video_call"
  | "add_credit"
  | "find_user"
  | "list_my_projects"
  | "add_collaborator"
  | "remove_collaborator"
  | "propose_multistep_plan"
  | "ask_clarification";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a new task on this project. Use when the user asks to add/remind/follow-up/do something concrete.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short imperative title, max 80 chars." },
          description: { type: ["string", "null"] },
          due_date: { type: ["string", "null"], description: "ISO YYYY-MM-DD or null." },
          assignee_user_id: { type: ["string", "null"], description: "Collaborator id or null." },
          priority: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
        },
        required: ["title", "description", "due_date", "assignee_user_id", "priority"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_task_done",
      description: "Mark an existing task as done. Match by title fragment if no id is given.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: ["string", "null"] },
          title_match: { type: ["string", "null"], description: "Fuzzy title fragment to match." },
        },
        required: ["task_id", "title_match"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message_to_collaborator",
      description:
        "Post a message into the project chat. Use for status updates, nudges, or when the user says 'tell/message X'.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message body to post in project chat." },
          mention_user_id: {
            type: ["string", "null"],
            description: "Optional collaborator id to address (will be prepended @name).",
          },
        },
        required: ["message", "mention_user_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project_summary",
      description: "Return a short status summary of this project (counts + risks).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_reminder",
      description: "Create a reminder task due on a given date.",
      parameters: {
        type: "object",
        properties: {
          what: { type: "string" },
          when_iso: { type: "string", description: "ISO YYYY-MM-DD" },
        },
        required: ["what", "when_iso"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_invoice",
      description:
        "Create a DRAFT invoice for this project (NEVER auto-sent). User must confirm in next turn to send. Use when user says 'invoice', 'bill', 'charge'.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Invoice total amount." },
          currency: { type: ["string", "null"], description: "ISO code, defaults to USD." },
          notes: { type: ["string", "null"], description: "Short line-item description." },
          due_in_days: { type: ["number", "null"], description: "Days until due, defaults to 14." },
        },
        required: ["amount", "currency", "notes", "due_in_days"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_quote",
      description:
        "Create a DRAFT quote (estimate) for this project with line items and a valid-until date. NEVER auto-sent — the user reviews and sends from Money. Use when user says 'quote', 'estimate', 'proposal'.",
      parameters: {
        type: "object",
        properties: {
          line_items: {
            type: "array",
            description: "List of line items.",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                rate: { type: "number" },
              },
              required: ["description", "quantity", "rate"],
              additionalProperties: false,
            },
          },
          currency: { type: ["string", "null"], description: "ISO code, defaults to project currency or USD." },
          valid_in_days: { type: ["number", "null"], description: "Days the quote is valid for, defaults to 30." },
          notes: { type: ["string", "null"] },
          tax_rate: { type: ["number", "null"], description: "Tax %, e.g. 10 for 10%." },
        },
        required: ["line_items", "currency", "valid_in_days", "notes", "tax_rate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_video_call",
      description: "Spin up a Daily video room for this project and post the join link in chat. Use for 'jump on a call', 'start meeting'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add_credit",
      description: "Add a ThriveCredit to the user's profile from this project (e.g. 'log this as a credit', 'add to my resume').",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", description: "User's role on the project, e.g. Director, Editor." },
          year: { type: ["number", "null"] },
          description: { type: ["string", "null"] },
        },
        required: ["role", "year", "description"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_user",
      description:
        "Resolve a spoken/typed person name (e.g. 'Rene Auguste') to a user_id. Searches the caller's accepted connections first, then public profiles. Returns up to 3 candidates. ALWAYS call this BEFORE add_collaborator / remove_collaborator when given a name.",
      parameters: {
        type: "object",
        properties: {
          name_query: { type: "string", description: "Person name as the user spoke it." },
        },
        required: ["name_query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_projects",
      description:
        "Return the caller's active projects (id, title, role). Use to disambiguate 'the X project' or to confirm the active project id when the user names a project that isn't the current one.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add_collaborator",
      description:
        "Add a user to a project as a collaborator (Auto-Accept — they land in the project immediately). Caller MUST be the project owner. Defaults to the CURRENT project_id unless target_project_id is given.",
      parameters: {
        type: "object",
        properties: {
          user_id_to_add: { type: "string", description: "Resolved user_id from find_user." },
          target_project_id: {
            type: ["string", "null"],
            description: "Project to add to. Null = current project.",
          },
          role: {
            type: ["string", "null"],
            enum: ["collaborator", "client", "creative", null],
            description: "Defaults to 'collaborator'.",
          },
        },
        required: ["user_id_to_add", "target_project_id", "role"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_collaborator",
      description: "Propose removing a collaborator from a project (queued for the user's explicit approval, never executes immediately). Owner-only. Defaults to current project.",
      parameters: {
        type: "object",
        properties: {
          user_id_to_remove: { type: "string" },
          target_project_id: { type: ["string", "null"] },
        },
        required: ["user_id_to_remove", "target_project_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_multistep_plan",
      description:
        "Use when the user's goal needs 3+ tools chained (e.g. 'wrap up this project', 'kick off the new shoot with Sarah and Tom', 'follow up on every overdue invoice'). Hands off to the Planner which returns a numbered plan card the user approves with one tap. DO NOT use for single-action requests.",
      parameters: {
        type: "object",
        properties: {
          goal: {
            type: "string",
            description: "The user's full goal in their own words, e.g. 'wrap up Q1 — send pending invoices, mark resolved tasks done, post a recap'.",
          },
        },
        required: ["goal"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description:
        "Use when intent or details are unclear. Ask one short follow-up question. No side effects.",
      parameters: {
        type: "object",
        properties: { question: { type: "string" } },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedTool = typeof body?._tool === "string" ? body._tool as ToolName : null;
    const project_id = body?.project_id ?? body?.target_project_id ?? null;
    const message = String(
      body?.message ??
      (requestedTool === "draft_invoice"
        ? `Draft a ${String(body?.currency ?? "USD").toUpperCase()} ${Number(body?.amount ?? 0)} invoice for ${body?.notes ?? body?.description ?? "this project"}`
        : requestedTool === "draft_quote"
          ? `Draft a quote with ${(Array.isArray(body?.line_items) ? body.line_items.length : 0)} line items`
          : body?.title ?? body?.what ?? body?.description ?? requestedTool ?? "")
    ).trim();
    const confirm_token = body?.confirm_token;

    // ── Special case: create_project doesn't need an existing project_id.
    if (requestedTool === "create_project") {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const title = String(body?.title ?? body?.project_title ?? "").trim().slice(0, 120);
      const description = body?.description ? String(body.description).slice(0, 4000) : null;
      if (!user?.id) {
        return new Response(JSON.stringify({ error: "Missing authenticated user for project creation" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!title) {
        return new Response(JSON.stringify({ error: "title required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newProj, error: createErr } = await admin
        .from("projects")
        .insert({
          title,
          description,
          created_by: user.id,
          status: "active",
          deal_type: "solo" as any,
          setup_completed: true,
        } as any)
        .select("id, title")
        .single();
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existingOwner } = await admin
        .from("project_collaborators")
        .select("id")
        .eq("project_id", newProj.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existingOwner) {
        await admin.from("project_collaborators").insert({
          project_id: newProj.id,
          user_id: user.id,
          role: "owner",
          status: "accepted",
          invited_by: user.id,
          accepted_at: new Date().toISOString(),
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            project_id: newProj.id,
            id: newProj.id,
            title: newProj.title,
            action_url: `/desk/${newProj.id}`,
            url: `/desk/${newProj.id}`,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!project_id || !message) {
      return new Response(JSON.stringify({ error: "project_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify project access
    const { data: hasAccess } = await admin.rpc("user_has_project_access", {
      project_id_param: project_id,
      user_id_param: user.id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "No access to this project" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily limit -- tier looked up server-side, never trusted from the
    // client (previously a client-supplied `is_pro` body flag bypassed this
    // entirely), and checked+incremented atomically via the same
    // consume_copilot_message RPC thrive-ai-chat/desk-ai already use on
    // this same desk_ai_usage table.
    const today = new Date().toISOString().slice(0, 10);
    const { data: profile } = await admin.from("profiles")
      .select("subscription_tier").eq("user_id", user.id).maybeSingle();
    const is_pro = ((profile?.subscription_tier as string) || "free") !== "free";
    const dailyCap = is_pro ? -1 : FREE_DAILY_LIMIT;

    const { data: capCheck, error: capErr } = await admin.rpc("consume_copilot_message", {
      _user_id: user.id, _daily_cap: dailyCap,
    }).single();
    if (capErr) {
      console.error("consume_copilot_message failed", capErr);
      return new Response(
        JSON.stringify({ error: "Could not verify usage limit. Try again shortly." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!capCheck?.allowed) {
      return new Response(
        JSON.stringify({
          error: "daily_limit",
          message: `You've used ${FREE_DAILY_LIMIT} agent actions today. Upgrade for unlimited.`,
          used: capCheck?.used ?? 0,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Gather context — project facts AND unified user identity AND Studio Brain
    const [projectRes, tasksRes, collabRes, history, copilotCtx, factsRes, entitiesRes] = await Promise.all([
      admin.from("projects").select("id, title, description, status, deadline, created_by, client_user_id, currency, workspace_type").eq("id", project_id).single(),
      admin.from("project_tasks").select("id, title, status, due_date, assigned_to, priority").eq("project_id", project_id).order("created_at", { ascending: false }).limit(40),
      admin.from("project_collaborators").select("user_id, role, profiles:profiles!project_collaborators_user_id_fkey(full_name)").eq("project_id", project_id),
      admin.from("agent_project_context").select("role, content").eq("project_id", project_id).eq("user_id", user.id).order("created_at", { ascending: true }).limit(10),
      loadCopilotContext(admin, user.id).catch(() => null),
      admin.from("studio_facts").select("kind, label, value, value_numeric, value_date, importance, confidence").eq("project_id", project_id).order("importance", { ascending: false }).order("updated_at", { ascending: false }).limit(40),
      admin.from("studio_entities").select("kind, name, importance, attrs").eq("project_id", project_id).order("importance", { ascending: false }).limit(40),
    ]);

    const project = projectRes.data;
    const tasks = tasksRes.data || [];
    const collaborators = (collabRes.data || []).map((c: any) => ({
      id: c.user_id,
      full_name: c.profiles?.full_name || "Member",
      role: c.role,
    }));
    const facts = (factsRes.data || []) as Array<{ kind: string; label: string; value: string | null; value_numeric: number | null; value_date: string | null; importance: number | null; confidence: number | null }>;
    const entities = (entitiesRes.data || []) as Array<{ kind: string; name: string; importance: number | null; attrs: any }>;

    const openTasks = tasks.filter((t) => t.status !== "done");
    const overdue = openTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date(),
    );

    const collabList = collaborators.length
      ? collaborators.map((c) => `- ${c.full_name} (id: ${c.id}, role: ${c.role})`).join("\n")
      : "(none)";
    const taskList = openTasks
      .slice(0, 15)
      .map((t) => `- [${t.id}] ${t.title}${t.due_date ? ` (due ${String(t.due_date).slice(0, 10)})` : ""}${t.priority ? ` [${t.priority}]` : ""}`)
      .join("\n") || "(no open tasks)";

    // Studio Brain — what we've learned about this project from briefs/drops
    const factLines = facts.length
      ? facts.map((f) => {
          const v = f.value ?? (f.value_numeric != null ? String(f.value_numeric) : f.value_date ?? "");
          const unverified = (f.confidence ?? 1) < 0.5 ? " [UNVERIFIED — confirm with user before using in any money/contact field]" : "";
          return `- ${f.kind}: ${f.label}${v ? ` = ${v}` : ""}${unverified}`;
        }).join("\n")
      : "(no facts yet)";
    const entityLines = entities.length
      ? entities.map((e) => `- ${e.kind}: ${e.name}`).join("\n")
      : "(no entities yet)";
    const studioBrain = `\nSTUDIO BRAIN (AI-extracted from briefs, drops & docs -- names/dates/venues are reliable, but anything marked [UNVERIFIED] came from a document the user never manually confirmed):\nFacts:\n${factLines}\nPeople & places:\n${entityLines}\n`;

    const userPreamble = copilotCtx
      ? renderContextPreamble(copilotCtx, "desk", { project_id })
      : "";

    const systemPrompt = `You are Kreto — a hands-on project operator inside ThriveDesk, the same Kreto persona the user knows from elsewhere on Kretopia. You DO things, not just talk. The USER FACTS block below is ALREADY loaded — never say "I don't have your context".

${userPreamble || "(no profile loaded — greet without a name)"}

CURRENT PROJECT: "${project?.title}" · status: ${project?.status} · deadline: ${project?.deadline || "n/a"} · type: ${project?.workspace_type || "general"}
Description: ${(project?.description || "").slice(0, 300)}
Open tasks (${openTasks.length}, ${overdue.length} overdue):
${taskList}
Collaborators (use these exact ids for assignee_user_id / mention_user_id):
${collabList}
${studioBrain}
Today: ${today}.

DECISION RULES:
1. MANDATORY: If USER FACTS lists a first name, use it in your FIRST sentence. NEVER use bracketed placeholders like "[Name]". NEVER claim you don't have the user's context — you do.
2. Classify intent: create | update | communicate | analyze.
3. Confidence:
   - HIGH (clear action + clear target) → call the matching tool directly.
   - MEDIUM (action clear, detail vague) → make a sensible default and call the tool.
   - LOW (ambiguous) → call ask_clarification with one short question.
4. Multi-step: chain 2 tool calls max per turn (e.g. summary + suggested task). For "wrap up project" type requests, prefer get_project_summary + one concrete next action.
5. Never invent collaborator ids — only use ones from the list above.
6. SAFETY: draft_invoice creates a DRAFT only — never auto-send. add_credit logs to the user's own profile (safe). start_video_call posts a join link in chat (safe). remove_collaborator is NEVER executed immediately — it is queued for the user's explicit approval (tap-to-confirm), since it revokes someone's access.
7. Money rule: if the user asks for an invoice without an amount, ask_clarification for amount + brief description. If the only source for an amount is a STUDIO BRAIN fact marked [UNVERIFIED], do NOT pass it straight to draft_invoice or draft_quote -- ask_clarification to have the user restate or confirm the number in this conversation first, even if they didn't ask you to double-check it.
8. Keep tool arg \`message\` / \`title\` / \`question\` natural, friendly, under 200 chars.
9. Treat USER FACTS as the only ground truth — never invent projects, invoices, or activity not listed.

ABSOLUTE NO-LYING RULE:
- The tools listed above are the ONLY things you can do here in Desk: create_task, mark_task_done, send_message_to_collaborator, get_project_summary, schedule_reminder, draft_invoice, draft_quote, start_video_call, add_credit, find_user, list_my_projects, add_collaborator, remove_collaborator, propose_multistep_plan, ask_clarification.
- MULTI-STEP REQUESTS: If the goal needs 3+ chained actions (e.g. "wrap up this project", "kick off the new shoot with Sarah and Tom", "follow up on every overdue invoice", "close out Q1") → call propose_multistep_plan with the user's goal verbatim. Do NOT try to do it inline. The Planner builds a numbered plan card the user approves with one tap.
- COLLABORATION REQUESTS: When the user says "add <name> to <project>" or "invite <name>", you MUST chain tools: (1) call list_my_projects if they named a project that isn't the current one, (2) call find_user with the person's name, (3) call add_collaborator with the resolved user_id and target_project_id. NEVER skip find_user. NEVER invent user_ids.
- If find_user returns 0 candidates → ask_clarification ("I couldn't find anyone called X — got their @username or email?"). If 2+ candidates → ask_clarification listing the matches.
- If the user asks for something NOT in the tool list (e.g. "send Rene the brief file", "change the deadline", "post to Instagram"), DO NOT pretend. Reply: "I can't do that from here yet — but I can [closest available thing], or you can do it from [where in the UI]." Never use future-tense promises like "I'm on it" for things you have no tool for.
- Never use future tense for things you ARE doing either. The receipt comes from the system after the tool returns ok=true.

When you respond in natural language (after tools), keep it to 1–2 sentences, action-focused. No emojis.`;

    // Build chat history
    const historyMsgs = (history.data || []).map((h: any) => ({
      role: h.role,
      content: h.content,
    }));

    let toolCalls: any[] = [];
    let replyText = "";
    // Receipt data (see 20260915100000 migration) -- populated from the AI
    // gateway's `usage` field below when the planner call runs; stays 0 for
    // the direct-tool shortcut path (requestedTool set), which makes no AI call.
    let turnTokens = 0;

    if (requestedTool && [
      "create_task",
      "mark_task_done",
      "send_message_to_collaborator",
      "get_project_summary",
      "schedule_reminder",
      "draft_invoice",
      "draft_quote",
      "start_video_call",
      "add_credit",
    ].includes(requestedTool)) {
      const directArgs = { ...body };
      delete (directArgs as any)._tool;
      delete (directArgs as any).project_id;
      delete (directArgs as any).target_project_id;
      delete (directArgs as any).message;
      toolCalls = [{ function: { name: requestedTool, arguments: JSON.stringify(directArgs) } }];
    } else {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMsgs,
          { role: "user", content: message },
        ],
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace Settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    turnTokens = Number(aiJson?.usage?.total_tokens || 0);
    const choice = aiJson.choices?.[0]?.message;
    toolCalls = choice?.tool_calls || [];
    replyText = choice?.content || "";
    }

    // Execute tools
    const actions: Array<{ tool: ToolName; args: any; result: any; ok: boolean }> = [];

    for (const tc of toolCalls) {
      const name = tc.function?.name as ToolName;
      let args: any = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        args = {};
      }

      try {
        if (name === "create_task" || name === "schedule_reminder") {
          const title =
            name === "schedule_reminder" ? `Reminder: ${args.what}` : args.title;
          const due = name === "schedule_reminder" ? args.when_iso : args.due_date;
          const { data, error } = await admin
            .from("project_tasks")
            .insert({
              project_id,
              created_by: user.id,
              title: String(title || "").slice(0, 200),
              description: args.description || null,
              due_date: due || null,
              assigned_to: args.assignee_user_id || null,
              priority: args.priority || "normal",
              status: "todo",
            })
            .select("id, title")
            .single();
          if (error) throw error;
          actions.push({ tool: name, args, result: data, ok: true });
        } else if (name === "mark_task_done") {
          let taskId = args.task_id;
          if (!taskId && args.title_match) {
            const lc = String(args.title_match).toLowerCase();
            const match = openTasks.find((t) => t.title.toLowerCase().includes(lc));
            taskId = match?.id;
          }
          if (!taskId) {
            actions.push({ tool: name, args, result: { error: "no match" }, ok: false });
          } else {
            const { data, error } = await admin
              .from("project_tasks")
              .update({ status: "done", updated_at: new Date().toISOString() })
              .eq("id", taskId)
              .select("id, title")
              .single();
            if (error) throw error;
            actions.push({ tool: name, args, result: data, ok: true });
          }
        } else if (name === "send_message_to_collaborator") {
          const mention = collaborators.find((c) => c.id === args.mention_user_id);
          const text = mention
            ? `@${mention.full_name.split(" ")[0]} ${args.message}`
            : args.message;
          const { data, error } = await admin
            .from("project_messages")
            .insert({
              project_id,
              user_id: user.id,
              message: String(text).slice(0, 2000),
            })
            .select("id")
            .single();
          if (error) throw error;
          actions.push({ tool: name, args, result: data, ok: true });
        } else if (name === "get_project_summary") {
          actions.push({
            tool: name,
            args,
            result: {
              open_tasks: openTasks.length,
              overdue: overdue.length,
              collaborators: collaborators.length,
              status: project?.status,
            },
            ok: true,
          });
        } else if (name === "draft_invoice") {
          const dueDays = Number(args.due_in_days ?? 14);
          const dueDate = new Date(Date.now() + dueDays * 86400000).toISOString();
          const amount = Number(args.amount || 0);
          const invNum = `INV-${Date.now().toString().slice(-8)}`;
          const { data, error } = await admin
            .from("invoices")
            .insert({
              invoice_number: invNum,
              project_id,
              issued_by: user.id,
              issued_to: project?.client_user_id ?? null,
              amount,
              currency: (args.currency || project?.currency || "USD").toUpperCase(),
              status: "draft",
              due_date: dueDate,
              notes: args.notes || args.description || null,
              document_type: "invoice",
            })
            .select("id, invoice_number, total_amount, currency")
            .single();
          if (error) throw error;
          actions.push({ tool: name, args, result: data, ok: true });
        } else if (name === "draft_quote") {
          const validDays = Number(args.valid_in_days ?? 30);
          const validUntil = new Date(Date.now() + validDays * 86400000).toISOString();
          const items = Array.isArray(args.line_items) ? args.line_items : [];
          const lineItems = items.map((it: any) => {
            const qty = Number(it.quantity || 1);
            const rate = Number(it.rate || 0);
            return {
              description: String(it.description || "Item"),
              quantity: qty,
              rate,
              amount: qty * rate,
            };
          });
          const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
          const taxRate = Number(args.tax_rate ?? 0);
          const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
          const total = +(subtotal + taxAmount).toFixed(2);
          const quoteNum = `QUO-${Date.now().toString().slice(-8)}`;
          const { data, error } = await admin
            .from("invoices")
            .insert({
              invoice_number: quoteNum,
              project_id,
              issued_by: user.id,
              issued_to: project?.client_user_id ?? null,
              amount: subtotal,
              tax_rate: taxRate || null,
              tax_amount: taxAmount || null,
              total_amount: total,
              currency: (args.currency || project?.currency || "USD").toUpperCase(),
              status: "draft",
              valid_until: validUntil,
              notes: args.notes || null,
              line_items: lineItems,
              document_type: "quote",
            })
            .select("id, invoice_number, total_amount, currency")
            .single();
          if (error) throw error;
          actions.push({ tool: name, args, result: data, ok: true });
        } else if (name === "start_video_call") {
          // Reuse existing create-video-room edge fn (handles Daily.co + chat post)
          const { data: vcData, error: vcError } = await admin.functions.invoke("create-video-room", {
            body: { project_id, user_name: user.email?.split("@")[0] || "Member" },
            headers: { Authorization: authHeader },
          });
          if (vcError) throw vcError;
          actions.push({ tool: name, args, result: { url: (vcData as any)?.url }, ok: true });
        } else if (name === "add_credit") {
          const { data, error } = await admin
            .from("credits")
            .insert({
              user_id: user.id,
              project_id: project?.id || null,
              project_name: project?.title || "Untitled project",
              role: String(args.role || "Contributor").slice(0, 80),
              year: args.year || new Date().getFullYear(),
              description: args.description || null,
              source: "thrive_agent",
              verification_status: "self_reported",
            })
            .select("id, project_name, role")
            .single();
          if (error) throw error;
          actions.push({ tool: name, args, result: data, ok: true });
        } else if (name === "remove_collaborator") {
          // remove_collaborator is one of the two highest-stakes tools
          // copilot-collaborator-tools exposes (see _shared/agentAuthority.ts)
          // -- it now REJECTS a direct desk-agent call with no prior
          // approval (previously this executed immediately with zero
          // gating, the exact "one authority, two doors" gap: the same
          // tool required human approval on the agent-orchestrator path but
          // none at all here). Instead of calling it directly, propose the
          // action through the same orch_runs/orch_actions ledger
          // agent-orchestrator uses, so the user sees a normal approval
          // card (AgentApprovalCard, driven by decideAgentAction ->
          // agent-orchestrator) rather than Kreto silently removing
          // someone's access mid-chat.
          const targetProjectId = String(args.target_project_id || project_id);
          const removeUserId = String(args.user_id_to_remove || "");
          const target = collaborators.find((c) => c.id === removeUserId);
          const previewTitle = `Remove ${target?.full_name ?? "collaborator"} from "${project?.title ?? "this project"}"`;
          const previewBody = `${target?.full_name ?? "They"} will immediately lose access to this project's chat, tasks, files and calls.`;

          const { data: proposalRun, error: runErr } = await admin
            .from("orch_runs")
            .insert({
              user_id: user.id,
              agent_kind: "project_manager",
              intent_text: message,
              intent_classified: "ThriveDesk — remove_collaborator (needs approval)",
              context: { project_id: targetProjectId, source: "desk_agent" },
              status: "awaiting_approval",
              source: "desk_agent",
              model: "google/gemini-3-flash-preview",
              tool_call_count: 1,
              tool_names: ["remove_collaborator"],
            })
            .select("id")
            .single();
          if (runErr || !proposalRun) {
            actions.push({ tool: name, args, result: { error: "Could not queue that for approval." }, ok: false });
          } else {
            const { data: proposalAction, error: actionErr } = await admin
              .from("orch_actions")
              .insert({
                run_id: proposalRun.id,
                user_id: user.id,
                tool_name: "remove_collaborator",
                tool_args: { target_project_id: targetProjectId, user_id_to_remove: removeUserId },
                risk_level: "requires_approval",
                status: "proposed",
                source: "desk_agent",
                preview_title: previewTitle,
                preview_body: previewBody,
              })
              .select("*")
              .single();
            if (actionErr || !proposalAction) {
              actions.push({ tool: name, args, result: { error: "Could not queue that for approval." }, ok: false });
            } else {
              actions.push({
                tool: name,
                args,
                result: { needs_approval: true, action: proposalAction, removed_name: target?.full_name ?? null },
                ok: true,
              });
            }
          }
        } else if (
          name === "find_user" ||
          name === "list_my_projects" ||
          name === "add_collaborator"
        ) {
          // Delegate to copilot-collaborator-tools (runs under caller's JWT, RLS-safe)
          const payload: Record<string, unknown> = { _tool: name, ...args, _source: "desk_agent" };
          if (name === "add_collaborator") {
            // Default target_project_id to current project_id when null/missing
            if (!payload.target_project_id) payload.target_project_id = project_id;
          }
          const { data, error } = await admin.functions.invoke("copilot-collaborator-tools", {
            body: payload,
            headers: { Authorization: authHeader },
          });
          if (error) throw error;
          const ok = (data as any)?.ok !== false && !(data as any)?.error;
          actions.push({ tool: name, args, result: data, ok });
        } else if (name === "propose_multistep_plan") {
          // Hand off to the planner — returns a plan_id the UI renders as a PlanCard
          const { data, error } = await admin.functions.invoke("copilot-planner", {
            body: {
              goal: String(args.goal ?? message).slice(0, 1000),
              project_id,
              surface: "desk",
            },
            headers: { Authorization: authHeader },
          });
          if (error) throw error;
          const ok = (data as any)?.ok !== false && !(data as any)?.error;
          actions.push({ tool: name, args, result: data, ok });
        } else if (name === "ask_clarification") {
          actions.push({ tool: name, args, result: { question: args.question }, ok: true });
        }
      } catch (e: any) {
        console.error(`tool ${name} failed`, e);
        actions.push({ tool: name, args, result: { error: e.message }, ok: false });
      }
    }

    // Compose user-facing reply
    let finalReply = replyText.trim();
    if (!finalReply && actions.length) {
      const a = actions[0];
      if (a.tool === "create_task" && a.ok) finalReply = `Added: "${a.result.title}".`;
      else if (a.tool === "schedule_reminder" && a.ok) finalReply = `Reminder set for ${a.args.when_iso}.`;
      else if (a.tool === "mark_task_done" && a.ok) finalReply = `Marked "${a.result.title}" done.`;
      else if (a.tool === "send_message_to_collaborator" && a.ok) finalReply = "Message posted to project chat.";
      else if (a.tool === "get_project_summary" && a.ok)
        finalReply = `${a.result.open_tasks} open tasks, ${a.result.overdue} overdue.`;
      else if (a.tool === "draft_invoice" && a.ok)
        finalReply = `Draft invoice ${a.result.invoice_number} for ${a.result.currency} ${a.result.total_amount} created. Review & send from Money tab.`;
      else if (a.tool === "draft_quote" && a.ok)
        finalReply = `Draft quote ${a.result.invoice_number} for ${a.result.currency} ${a.result.total_amount} created. Review & send from Money tab.`;
      else if (a.tool === "start_video_call" && a.ok)
        finalReply = "Video room is live and link posted in chat.";
      else if (a.tool === "add_credit" && a.ok)
        finalReply = `Credit added: ${a.result.role} on "${a.result.project_name}".`;
      else if (a.tool === "add_collaborator" && a.ok) {
        const r: any = a.result || {};
        finalReply = `Added ${r.invitee_name ?? "them"} to ${r.project_title ?? "the project"}. They'll see it in their Desk.`;
      }
      else if (a.tool === "remove_collaborator" && a.ok) {
        const r: any = a.result || {};
        finalReply = r.needs_approval
          ? `Queued removing ${r.removed_name ?? "them"} — tap Approve to confirm, they'll lose access as soon as you do.`
          : `Removed ${r.removed_name ?? "them"} from ${r.project_title ?? "the project"}.`;
      }
      else if (a.tool === "find_user" && a.ok) {
        const cands: any[] = (a.result as any)?.candidates ?? [];
        if (!cands.length) finalReply = "I couldn't find anyone by that name in your network.";
        else if (cands.length === 1) finalReply = `Found ${cands[0].full_name}. What should I do next?`;
        else finalReply = `I found ${cands.length} matches: ${cands.map((c) => c.full_name).join(", ")}. Which one?`;
      }
      else if (a.tool === "list_my_projects" && a.ok) {
        const ps: any[] = (a.result as any)?.projects ?? [];
        finalReply = ps.length ? `You have ${ps.length} active projects.` : "No active projects yet.";
      }
      else if (a.tool === "propose_multistep_plan" && a.ok) {
        const r: any = a.result || {};
        if (!r.plan_id) finalReply = r.summary ?? "I couldn't break that into clean steps — try being more specific.";
        else finalReply = `Here's the plan — review the ${(r.steps?.length ?? 0)} steps and tap Approve.`;
      }
      else if (a.tool === "ask_clarification") finalReply = a.result.question;
      else if (!a.ok) finalReply = `Couldn't complete that — ${(a.result as any)?.error ?? "unknown error"}.`;
      else finalReply = "Done.";
    }
    if (!finalReply) finalReply = "Got it.";

    // Persist context
    await admin.from("agent_project_context").insert([
      { project_id, user_id: user.id, role: "user", content: message },
      {
        project_id,
        user_id: user.id,
        role: "assistant",
        content: finalReply,
        tool_calls: actions.length ? actions : null,
      },
    ]);

    // Usage was already atomically incremented by consume_copilot_message above.

    // Receipt (item: work-unit estimates and receipts) -- every desk-agent
    // turn now leaves a durable record in the same orch_runs ledger
    // agent-orchestrator uses (source='desk_agent'), instead of desk-agent
    // turns being invisible to that system entirely. Foundation only: not
    // shown in any UI yet, just captured. Best-effort -- must never fail
    // the actual chat turn, which has already completed by this point.
    await admin.from("orch_runs").insert({
      user_id: user.id,
      agent_kind: "project_manager",
      intent_text: message.slice(0, 2000),
      intent_classified: requestedTool ? `direct tool: ${requestedTool}` : "ThriveDesk chat turn",
      context: { project_id },
      status: actions.some((a) => !a.ok) ? "failed" : "completed",
      source: "desk_agent",
      model: requestedTool ? null : "google/gemini-3-flash-preview",
      tokens_used: turnTokens,
      tool_call_count: actions.length,
      tool_names: Array.from(new Set(actions.map((a) => a.tool))),
      summary: finalReply.slice(0, 500),
    }).then(
      ({ error }) => { if (error) console.warn("[desk-agent] receipt insert failed (non-fatal)", error); },
      (e) => console.warn("[desk-agent] receipt insert failed (non-fatal)", e),
    );

    return new Response(
      JSON.stringify({
        reply: finalReply,
        actions,
        used: capCheck.used,
        limit: is_pro ? null : FREE_DAILY_LIMIT,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("desk-agent error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
