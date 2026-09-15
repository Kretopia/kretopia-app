// weekly-recap — aggregates last 7 days of project activity and asks Gemini
// to write a warm, ready-to-send client update + a draft invoice line-item list.
//
// Body: { projectId?: string, days?: number }
// If projectId omitted, aggregates across all projects the user owns.
//
// Returns: {
//   email: { subject, body, recipient_suggestion },
//   invoice: { line_items: [{ description, quantity, unit_price }], total_suggestion, currency },
//   highlights: string[],
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Activity {
  project_title: string;
  client_name: string | null;
  tasks_completed: Array<{ title: string; completed_at: string }>;
  files_added: Array<{ name: string; added_at: string }>;
  notes: Array<{ content: string; created_at: string }>;
  messages_count: number;
  invoices_unpaid: Array<{ amount: number; currency: string; status: string }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body.projectId;
    const days: number = Math.max(1, Math.min(30, body.days ?? 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 1. Resolve target projects
    let projectQuery = supabase
      .from("projects")
      .select("id, title, client_name, currency, client_price")
      .eq("created_by", user.id);
    if (projectId) projectQuery = projectQuery.eq("id", projectId);
    const { data: projects } = await projectQuery.limit(20);
    const projectList = projects || [];
    if (projectList.length === 0) {
      return new Response(
        JSON.stringify({ error: "No projects found in window" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = projectList.map((p: any) => p.id);

    // 2. Aggregate activity in parallel
    const [tasksRes, filesRes, notesRes, msgsRes, invRes] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("project_id, title, status, updated_at")
        .in("project_id", ids)
        .eq("status", "done")
        .gte("updated_at", since),
      supabase
        .from("project_files")
        .select("project_id, file_name, created_at")
        .in("project_id", ids)
        .gte("created_at", since),
      supabase
        .from("project_notes")
        .select("project_id, content, created_at")
        .in("project_id", ids)
        .gte("created_at", since)
        .then((r: any) => r, () => ({ data: [] })),
      supabase
        .from("project_messages")
        .select("project_id, id")
        .in("project_id", ids)
        .gte("created_at", since)
        .then((r: any) => r, () => ({ data: [] })),
      supabase
        .from("invoices")
        .select("project_id, total_amount, currency, status")
        .in("project_id", ids)
        .in("status", ["pending", "sent", "overdue"]),
    ]);

    const byProject = new Map<string, Activity>();
    for (const p of projectList as any[]) {
      byProject.set(p.id, {
        project_title: p.title,
        client_name: p.client_name,
        tasks_completed: [],
        files_added: [],
        notes: [],
        messages_count: 0,
        invoices_unpaid: [],
      });
    }

    for (const t of (tasksRes.data || []) as any[]) {
      byProject.get(t.project_id)?.tasks_completed.push({
        title: t.title,
        completed_at: t.updated_at,
      });
    }
    for (const f of (filesRes.data || []) as any[]) {
      byProject.get(f.project_id)?.files_added.push({
        name: f.file_name,
        added_at: f.created_at,
      });
    }
    for (const n of (notesRes.data || []) as any[]) {
      byProject.get(n.project_id)?.notes.push({
        content: n.content,
        created_at: n.created_at,
      });
    }
    for (const m of (msgsRes.data || []) as any[]) {
      const a = byProject.get(m.project_id);
      if (a) a.messages_count += 1;
    }
    for (const inv of (invRes.data || []) as any[]) {
      byProject.get(inv.project_id)?.invoices_unpaid.push({
        amount: Number(inv.total_amount) || 0,
        currency: inv.currency || "USD",
        status: inv.status,
      });
    }

    const activity = Array.from(byProject.values()).filter(
      (a) =>
        a.tasks_completed.length +
          a.files_added.length +
          a.notes.length +
          a.messages_count >
        0
    );

    if (activity.length === 0) {
      return new Response(
        JSON.stringify({
          email: {
            subject: "Quiet week",
            body: "No activity in the last " + days + " days. Nothing to recap.",
            recipient_suggestion: null,
          },
          invoice: { line_items: [], total_suggestion: 0, currency: "USD" },
          highlights: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build prompt for Gemini
    const summary = activity
      .map((a) => {
        const tasks = a.tasks_completed.map((t) => `- ${t.title}`).join("\n");
        const files = a.files_added.map((f) => `- ${f.name}`).join("\n");
        const notes = a.notes.map((n) => `- ${n.content.slice(0, 200)}`).join("\n");
        return [
          `## ${a.project_title}${a.client_name ? ` (for ${a.client_name})` : ""}`,
          `Messages exchanged: ${a.messages_count}`,
          tasks ? `Completed:\n${tasks}` : "",
          files ? `Files delivered:\n${files}` : "",
          notes ? `Notes:\n${notes}` : "",
          a.invoices_unpaid.length > 0
            ? `Outstanding invoices: ${a.invoices_unpaid
                .map((i) => `${i.currency} ${i.amount} (${i.status})`)
                .join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const targetCcy =
      (projectList[0] as any)?.currency?.toUpperCase?.() || "USD";

    const prompt = `You are writing a warm, professional weekly client update on behalf of a creative freelancer. Tone: friendly, confident, no fluff. Use the creator's first-person voice ("I"). Reference specific work done.

ACTIVITY (last ${days} days):
${summary}

Return JSON only matching this schema:
{
  "email": {
    "subject": "short, specific subject line — never generic",
    "body": "2–4 short paragraphs in plain text. Greet warmly, summarize wins, list deliverables/files concisely, end with one clear next step or question. Sign off with '— '.",
    "recipient_suggestion": "best guess at who to send this to, or null"
  },
  "invoice": {
    "line_items": [{ "description": "string", "quantity": 1, "unit_price": 0 }],
    "total_suggestion": 0,
    "currency": "${targetCcy}"
  },
  "highlights": ["3 to 5 short bullets summarizing the week"]
}

Rules:
- Email body: <= 1200 chars total, easy to skim, no markdown headers.
- Invoice line items: only include if real billable work was done this week. If nothing billable, return empty array and total 0.
- Currency must be "${targetCcy}".
- Never invent client names. Use the names provided or fall back to "your team".`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_FLASH,
          messages: [
            {
              role: "system",
              content:
                "You write client updates that sound human and earned. Output strict JSON only. Never use the word 'leverage' or 'synergy'.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[weekly-recap] AI error", aiRes.status, txt);
      return new Response(
        JSON.stringify({ error: "AI gateway failed", detail: txt.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[weekly-recap] parse fail", content.slice(0, 300));
      parsed = {
        email: { subject: "Weekly update", body: content, recipient_suggestion: null },
        invoice: { line_items: [], total_suggestion: 0, currency: targetCcy },
        highlights: [],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[weekly-recap] fatal", err);
    return new Response(
      JSON.stringify({ error: err?.message || "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
