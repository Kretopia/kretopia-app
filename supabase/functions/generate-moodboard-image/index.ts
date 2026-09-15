// Generate a moodboard reference image with AI and attach it to the project.
// - Uses Lovable AI Gateway (Gemini image model)
// - Uploads to the existing `project-files` storage bucket so it appears
//   natively on the moodboard polaroid strip.
// - Inserts a project_files row owned by the requesting user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH_IMAGE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI not configured" }, 500);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body?.project_id;
    const rawPrompt: string = (body?.prompt ?? "").toString().trim();
    if (!projectId) return json({ error: "project_id required" }, 400);
    if (!rawPrompt) return json({ error: "prompt required" }, 400);
    if (rawPrompt.length > 600) return json({ error: "prompt too long" }, 400);

    // Membership check — user must be owner or collaborator
    const { data: project } = await userClient
      .from("projects")
      .select("id, title, description, mood, workspace_type, created_by")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return json({ error: "project not found" }, 404);

    let allowed = project.created_by === user.id;
    if (!allowed) {
      const { data: collab } = await userClient
        .from("project_collaborators")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      allowed = !!collab;
    }
    if (!allowed) return json({ error: "Not a project member" }, 403);

    // Build a richer prompt grounded in the brief & mood
    const briefSnippet = (project.description || "").slice(0, 500);
    const styledPrompt = [
      `Mood board reference image for a ${project.workspace_type || "creative"} project titled "${project.title}".`,
      project.mood ? `Overall mood: ${project.mood}.` : "",
      briefSnippet ? `Brief context: ${briefSnippet}` : "",
      `Specific request: ${rawPrompt}`,
      "Style: cinematic, evocative, suitable as visual inspiration. No text, no watermarks, no logos.",
    ]
      .filter(Boolean)
      .join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH_IMAGE,
        messages: [{ role: "user", content: styledPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Too many requests, try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await aiResp.json();
    const imageData: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) {
      return json({ error: "No image generated. Try a different prompt." }, 502);
    }

    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Use service role for storage write so we don't fight with bucket policies
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const fileName = `ai-moodboard-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const path = `${projectId}/${fileName}`;

    const { error: upErr } = await admin.storage
      .from("project-files")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) {
      console.error("upload error", upErr);
      return json({ error: "Upload failed: " + upErr.message }, 500);
    }

    const { data: row, error: insErr } = await admin
      .from("project_files")
      .insert({
        project_id: projectId,
        user_id: user.id,
        file_name: `AI · ${rawPrompt.slice(0, 50)}.png`,
        file_url: path,
        file_type: "image/png",
        file_size: bytes.byteLength,
      })
      .select("id, file_url, file_name")
      .single();
    if (insErr) {
      console.error("insert error", insErr);
      return json({ error: "Could not attach to project" }, 500);
    }

    return json({ ok: true, file: row });
  } catch (e) {
    console.error("generate-moodboard-image error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
