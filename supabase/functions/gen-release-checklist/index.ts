import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { release_type, release_date, distributor, project_title, artist } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const sys = `You are a music release manager. Generate a complete, ordered release checklist (10-16 items) for an independent artist. Cover: masters, artwork, metadata/ISRC/UPC, distributor delivery, pre-save, press kit, pitch to playlists, social teasers, release-day post, performance royalty registration, post-release recap. Each item: short imperative title (<8 words) and optional days_before_release (positive int) — release-day = 0, post-release negative is fine.`;

    const user = `RELEASE: ${project_title || "Untitled"}
ARTIST: ${artist || "—"}
TYPE: ${release_type || "single"}
RELEASE DATE: ${release_date || "TBD"}
DISTRIBUTOR: ${distributor || "—"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools: [{
          type: "function",
          function: {
            name: "draft_checklist",
            description: "Return release checklist",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      days_before_release: { type: "number" },
                    },
                    required: ["title"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "draft_checklist" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again soon." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI error");
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { items: [] };
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("gen-release-checklist", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
