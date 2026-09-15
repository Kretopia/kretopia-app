// Generates a tight set of podcast interview questions for a guest/episode.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { episode_title, guest_names = [], show_concept, notes } = await req.json();

    if (!episode_title) {
      return new Response(JSON.stringify({ error: "episode_title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Show concept: ${show_concept || "(not specified)"}
Episode: ${episode_title}
Guest(s): ${guest_names.length ? guest_names.join(", ") : "(no guests yet)"}
Producer notes: ${notes || "(none)"}

Generate 8 interview questions: 1 warm opener, 5 substantive (story, craft, turning points, opinions), 1 challenge/spicy, 1 closer that prompts a great soundbite. Avoid generic "tell us about yourself".`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: "You are a senior podcast producer. Craft sharp, specific, conversational interview questions. No filler." },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_questions",
            description: "Return the interview questions.",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      kind: { type: "string", enum: ["opener", "substantive", "challenge", "closer"] },
                      text: { type: "string" },
                    },
                    required: ["kind", "text"],
                    additionalProperties: false,
                  },
                  minItems: 6,
                  maxItems: 10,
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_questions" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Workspace AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = tc ? JSON.parse(tc.function.arguments) : { questions: [] };
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gen-podcast-questions error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
