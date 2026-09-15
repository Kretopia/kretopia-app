// Kreto's optional organising pass over imported data.
// Generates SUGGESTIONS ONLY — nothing becomes a real task/milestone/brief entry
// until the user approves it, and every created row keeps its source reference.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM = `You are Kreto, an executive producer reading a creative team's imported project history.
Extract only what is actually evidenced in the material. Never invent people, dates or decisions.
Return: confirmed decisions, outstanding action items, deadlines, unresolved questions, mentioned files,
named participants, risks, missed deadlines, important links and repeated discussions.
Every item must quote or clearly point at the source message it came from.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { job_id, action = "generate", suggestion_ids } = await req.json();
    if (!job_id) return json({ error: "job_id required" }, 400);

    const { data: job } = await admin.from("import_jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "Import not found" }, 404);
    const { data: allowed } = await userClient.rpc("user_has_project_access", {
      project_id_param: job.project_id, user_id_param: user.id,
    });
    if (job.user_id !== user.id && !allowed) return json({ error: "No access" }, 403);

    // ------------------------------------------------ approve / ignore ----
    if (action === "approve" || action === "ignore") {
      const { data: sugs } = await admin.from("import_suggestions").select("*")
        .eq("import_job_id", job_id).in("id", suggestion_ids ?? []).eq("status", "pending");

      if (action === "ignore") {
        await admin.from("import_suggestions").update({ status: "ignored" }).in("id", (sugs ?? []).map((s: any) => s.id));
        return json({ ok: true, ignored: sugs?.length ?? 0 });
      }

      let createdCount = 0;
      for (const s of sugs ?? []) {
        const p = s.payload ?? {};
        let table: string | null = null;
        let row: Record<string, unknown> | null = null;

        if (s.kind === "task") {
          table = "project_tasks";
          row = {
            project_id: job.project_id, created_by: user.id,
            title: String(s.title).slice(0, 300), description: s.detail,
            status: "todo", priority: p.priority ?? "normal", due_date: p.due_date ?? null,
            labels: [`kreto:${job.provider}`],
            import_job_id: job_id, source_provider: job.provider,
            external_url: s.source_url, imported_at: new Date().toISOString(),
          };
        } else if (s.kind === "milestone") {
          table = "milestones";
          row = {
            project_id: job.project_id, created_by: user.id,
            title: String(s.title).slice(0, 300), description: s.detail,
            due_date: p.due_date ?? null, status: "pending",
            import_job_id: job_id, source_provider: job.provider,
            external_url: s.source_url, imported_at: new Date().toISOString(),
          };
        } else {
          // decisions, risks, questions → read-only brief note
          table = "project_notes";
          row = {
            project_id: job.project_id, created_by: user.id,
            title: `${s.kind === "decision" ? "Decision" : s.kind === "risk" ? "Risk" : "Open question"}: ${String(s.title).slice(0, 200)}`,
            content: [s.detail, s.source_url ? `\n\nSource: ${s.source_url}` : ""].join(""),
            is_read_only: true,
            import_job_id: job_id, source_provider: job.provider,
            external_url: s.source_url, imported_at: new Date().toISOString(),
          };
        }

        const { data: ins, error } = await admin.from(table).insert(row).select("id").single();
        if (error) {
          await admin.from("import_audit_log").insert({
            import_job_id: job_id, action: `approve:${s.kind}`, result: "failed", error: error.message,
          });
          continue;
        }
        createdCount++;
        await admin.from("import_suggestions").update({
          status: "approved", approved_by: user.id, approved_at: new Date().toISOString(),
          destination_table: table, destination_id: ins.id,
        }).eq("id", s.id);
        await admin.from("import_audit_log").insert({
          import_job_id: job_id, action: `approve:${s.kind}`, destination_table: table,
          destination_object_id: ins.id, result: "created",
        });
      }
      return json({ ok: true, created: createdCount });
    }

    // ------------------------------------------------ generate -----------
    const { data: objs } = await admin
      .from("import_source_objects")
      .select("id,external_object_type,title,external_author_name,source_created_at,raw_metadata,external_url")
      .eq("import_job_id", job_id)
      .in("external_object_type", ["message", "comment", "note", "task"])
      .order("source_created_at", { ascending: true })
      .limit(1200);

    if (!objs?.length) return json({ ok: true, suggestions: [] });

    const transcript = objs.map((o: any) => {
      const body = String(o.raw_metadata?.body ?? o.title ?? "").slice(0, 800);
      const who = o.external_author_name ?? "—";
      const when = o.source_created_at ? String(o.source_created_at).slice(0, 10) : "";
      return `[${o.id}] (${o.external_object_type} ${when} ${who}) ${body}`;
    }).join("\n").slice(0, 120000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Project: ${job.source_name} (from ${job.provider}).\n\n${transcript}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "record_suggestions",
            description: "Record organising suggestions for the user to approve.",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["task", "milestone", "decision", "risk", "question", "participant", "link"] },
                      title: { type: "string" },
                      detail: { type: "string" },
                      due_date: { type: "string", description: "ISO date if clearly stated, else omit" },
                      priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                      source_object_id: { type: "string", description: "the [id] of the source line" },
                      confidence: { type: "number" },
                    },
                    required: ["kind", "title", "source_object_id"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "record_suggestions" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`AI gateway ${res.status}: ${body}`);
      return json({ error: "Kreto couldn't read this import right now", status: res.status, details: body }, res.status);
    }

    const ai = await res.json();
    const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { suggestions: [] };
    const validIds = new Set(objs.map((o: any) => o.id));
    const urlById = new Map(objs.map((o: any) => [o.id, o.external_url]));

    const rows = (parsed.suggestions ?? [])
      .filter((s: any) => s?.title)
      .slice(0, 60)
      .map((s: any) => ({
        import_job_id: job_id,
        project_id: job.project_id,
        kind: s.kind,
        title: String(s.title).slice(0, 300),
        detail: s.detail ?? null,
        payload: { due_date: s.due_date ?? null, priority: s.priority ?? "normal" },
        source_object_id: validIds.has(s.source_object_id) ? s.source_object_id : null,
        source_url: urlById.get(s.source_object_id) ?? null,
        confidence: s.confidence ?? null,
        status: "pending",
      }));

    await admin.from("import_suggestions").delete().eq("import_job_id", job_id).eq("status", "pending");
    if (rows.length) await admin.from("import_suggestions").insert(rows);
    await admin.from("import_audit_log").insert({
      import_job_id: job_id, action: "kreto_suggest", result: "ok", detail: { count: rows.length },
    });

    return json({ ok: true, suggestions: rows.length });
  } catch (e) {
    console.error("import-suggest failed:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
