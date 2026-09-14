// Studio AI Create — copy/text generation.
// - Same auth/membership/gate pattern as generate-studio-image.
// - Lovable AI Gateway, text-only model.
// - creative_assets.file_url is NOT NULL with no raw-text column, so the
//   generated text is saved as a small .md file in the same private
//   `project-files` bucket used everywhere else, then referenced like any
//   other asset. The raw text is also returned directly so the UI can
//   render it without a second fetch.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAndConsumeStudioAIGeneration, refundStudioAIGeneration } from "../_shared/studioAIGate.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

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
    if (!auth) return json({ error: "Unauthorized" }, 401);
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

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
    if (rawPrompt.length > 1500) return json({ error: "prompt too long" }, 400);

    const { data: project } = await userClient
      .from("projects")
      .select("id, title, description, workspace_type, created_by")
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPro = !!profile?.subscription_tier && profile.subscription_tier !== "free";

    const gate = await checkAndConsumeStudioAIGeneration(admin, user.id, isPro);
    if (!gate.allowed) return gate.response;

    const briefSnippet = (project.description || "").slice(0, 500);
    const systemPrompt =
      "You write clear, professional creative-project copy (captions, pitches, descriptions, short scripts). " +
      "Respond with the requested copy only — no preamble, no markdown headers unless asked for, no meta-commentary.";
    const userPrompt = [
      `Project: "${project.title}" (${project.workspace_type || "creative"} project).`,
      briefSnippet ? `Brief context: ${briefSnippet}` : "",
      `Request: ${rawPrompt}`,
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
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      await refundStudioAIGeneration(admin, user.id);
      if (aiResp.status === 429) return json({ error: "Too many requests, try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await aiResp.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) {
      await refundStudioAIGeneration(admin, user.id);
      return json({ error: "No copy generated. Try a different prompt." }, 502);
    }

    const bytes = new TextEncoder().encode(text);
    const path = `${projectId}/ai/copy/${Date.now()}-${crypto.randomUUID()}.md`;
    const { error: upErr } = await admin.storage
      .from("project-files")
      .upload(path, bytes, { contentType: "text/markdown", upsert: false });
    if (upErr) {
      await refundStudioAIGeneration(admin, user.id);
      console.error("upload error", upErr);
      return json({ error: "Upload failed: " + upErr.message }, 500);
    }

    const { data: asset, error: insErr } = await admin
      .from("creative_assets")
      .insert({
        project_id: projectId,
        folder_id: null,
        name: `AI Copy · ${rawPrompt.slice(0, 50)}`,
        file_url: path,
        file_size: bytes.byteLength,
        file_type: "text/markdown",
        media_type: "document",
        uploaded_by: user.id,
        source: "ai",
        generation_prompt: rawPrompt,
        generation_model: GEMINI_FLASH,
      })
      .select("*")
      .single();
    if (insErr) {
      console.error("insert error", insErr);
      return json({ error: "Generated but could not save to Assets" }, 500);
    }

    return json({ ok: true, asset, text, used: gate.used, cap: gate.cap });
  } catch (e) {
    console.error("generate-studio-copy error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
