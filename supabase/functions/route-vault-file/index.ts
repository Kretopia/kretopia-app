// route-vault-file — picks the best Vault folder for a newly uploaded file.
// Input: { project_id, file_id }
// Reads project context + folder list, classifies via Lovable AI, updates folder_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface PickResult {
  folder_name: string | null;
  reason?: string;
  confidence?: number;
}

const FALLBACK_FOLDER = "Brief & References";

async function pickFolder(
  fileName: string,
  fileType: string | null,
  folderNames: string[],
  projectTitle: string,
  briefSummary: string | null,
): Promise<PickResult> {
  if (!LOVABLE_API_KEY || folderNames.length === 0) {
    return { folder_name: null };
  }
  const sys = `You file uploads into the right folder of a creative project Vault.
Return JSON only: {"folder_name": exact match from the provided list or null, "reason": short, "confidence": 0..1}.
Rules:
- Images/PDF mood references → "Brief & References" or "Moodboard" if present.
- Active edits, drafts, raws (.psd, .prproj, .ai, work-in-progress versions, "v1/v2/draft") → "Work-in-Progress".
- Final/master/export files → "Final Deliverables".
- Files explicitly for the client → "Client-Shared".
- Receipts, invoices, contracts → a folder mentioning those words if present, otherwise null.
- If unsure, return null and the owner will place it.`;

  const user = `Project: "${projectTitle}"
Brief: ${briefSummary?.slice(0, 600) || "(none)"}
File: "${fileName}" (type: ${fileType || "unknown"})
Available folders: ${JSON.stringify(folderNames)}`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(txt) as PickResult;
    if (parsed.folder_name && folderNames.includes(parsed.folder_name)) {
      return parsed;
    }
    return { folder_name: null, reason: parsed.reason };
  } catch (e) {
    console.warn("[route-vault-file] pick fallback:", (e as Error).message);
    return { folder_name: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Previously used the service-role key to read/write any project's files
    // by id with no check that the caller belonged to that project (IDOR).
    // Require a real caller and confirm they're the file's own uploader
    // before doing anything — this matches how the function is actually
    // invoked client-side (right after the caller uploads their own file).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, file_id } = await req.json();
    if (!project_id || !file_id) {
      return new Response(JSON.stringify({ error: "project_id and file_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const rateLimit = await checkAiFeatureRateLimit(admin, user.id, "route-vault-file");
    if (!rateLimit.allowed) return rateLimit.response;

    const [{ data: file }, { data: project }, { data: folders }] = await Promise.all([
      admin.from("project_files").select("id, file_name, file_type, folder_id, user_id").eq("id", file_id).maybeSingle(),
      admin.from("projects").select("title, brief_summary, created_by").eq("id", project_id).maybeSingle(),
      admin.from("project_file_folders").select("id, name").eq("project_id", project_id).is("parent_id", null),
    ]);

    if (!file) throw new Error("file not found");
    if (file.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized for this file" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Don't override an explicit folder pick.
    if (file.folder_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "already filed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folderRows = (folders || []) as Array<{ id: string; name: string }>;
    const names = folderRows.map((f) => f.name);
    const pick = await pickFolder(
      file.file_name,
      file.file_type,
      names,
      project?.title ?? "Untitled",
      project?.brief_summary ?? null,
    );

    let chosenName = pick.folder_name;
    // Fallback: if the uploader is NOT the owner, drop into "Brief & References" so the owner sees it.
    if (!chosenName && project?.created_by && file.user_id && file.user_id !== project.created_by) {
      chosenName = names.includes(FALLBACK_FOLDER) ? FALLBACK_FOLDER : null;
    }

    const target = folderRows.find((f) => f.name === chosenName) || null;
    if (target) {
      await admin.from("project_files").update({ folder_id: target.id }).eq("id", file_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        folder_name: target?.name ?? null,
        folder_id: target?.id ?? null,
        reason: pick.reason ?? null,
        confidence: pick.confidence ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[route-vault-file]", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
