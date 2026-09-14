// Spark Ideas — generate 4-6 sticky-note ideas for a project's cork board.
// Reads the project brief and returns short, punchy creative ideas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { project_id, hint } = await req.json();
    if (!project_id || typeof project_id !== "string") {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("title, description, workspace_type, mood")
      .eq("id", project_id)
      .maybeSingle();

    if (!project) {
      return new Response(JSON.stringify({ error: "project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull existing sticky text so the model avoids duplicating angles.
    const { data: existingPins } = await supabase
      .from("project_pins")
      .select("content, kind")
      .eq("project_id", project_id)
      .eq("kind", "sticky")
      .limit(40);

    const existing = (existingPins || [])
      .map((p: any) => (p.content || "").trim())
      .filter((s: string) => s.length > 0)
      .slice(0, 30);

    const brief = (project.description || "").slice(0, 2000);
    const existingBlock = existing.length
      ? `\n\nAlready pinned (DO NOT repeat or paraphrase any of these — generate fresh, distinct angles):\n${existing.map((s: string) => `- ${s}`).join("\n")}`
      : "";
    const userPrompt = hint
      ? `Brief:\n${brief}\n\nFocus area: ${hint}${existingBlock}`
      : `Brief:\n${brief || "(no brief written yet)"}${existingBlock}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "You are a creative collaborator on a creative project. Generate 5 short, punchy, distinct sticky-note ideas a creator could pin to their studio cork board to spark direction. Each idea should be 6-14 words max, tactile, specific, and FOR ACTION (a creative angle, hook, mood, scene, treatment, sound, headline, etc). Avoid filler like 'maybe' or 'consider'. If existing pins are provided, do NOT repeat, rephrase, or remix them — invent fresh angles. Respond ONLY with JSON: {\"ideas\":[\"...\",\"...\"]}",
          },
          {
            role: "user",
            content: `Project: ${project.title}\nType: ${project.workspace_type || "general"}\nMood: ${project.mood || "n/a"}\n\n${userPrompt}\n\nReturn 5 sticky note ideas as JSON.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI error: ${t.slice(0, 200)}` }), {
        status: aiResp.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let ideas: string[] = [];
    try {
      const raw = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      ideas = Array.isArray(parsed.ideas)
        ? parsed.ideas.filter((s: unknown) => typeof s === "string").slice(0, 6)
        : [];
    } catch {
      // ignore
    }

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
