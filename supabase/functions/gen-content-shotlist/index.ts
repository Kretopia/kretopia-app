// Generates a shot list from a brief using Lovable AI Gateway (Gemini).
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brief, project_title, format } = await req.json();
    if (!brief || typeof brief !== "string") {
      return new Response(JSON.stringify({ error: "brief required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are a creative producer. Convert briefs into concrete shot lists for ${format || "short-form video / photo content"}.
Return ONLY JSON: { "shots": [{ "scene_no": 1, "shot_no": 1, "description": "...", "shot_type": "wide|medium|close-up|over-shoulder|insert|establishing", "location": "...", "talent": ["..."], "props": ["..."], "duration_seconds": 5 }, ...] }
Aim for 6-12 shots. Be specific and shootable. No extra prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Project: ${project_title || "Untitled"}\n\nBrief:\n${brief}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { shots: [] }; }
    const shots = Array.isArray(parsed.shots) ? parsed.shots : [];

    return new Response(JSON.stringify({ shots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
