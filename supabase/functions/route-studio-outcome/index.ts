// Phase E — Outcome Composer router.
// Takes a free-text user request inside a Studio ("make me a sponsor deck for
// Bali Carnival, premium tone") and decides which Executive-Producer outcome
// to spin up. Returns a routing payload the client uses to navigate.
//
// No DB writes. Pure routing decision. Studio Brain is already injected by
// the destination engine (thrive-document-engine), so we don't re-fetch it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DOC_INTENTS = [
  "sponsor_deck",
  "pitch_deck",
  "business_plan",
  "client_proposal",
  "treatment",
  "rate_card",
  "moodboard_deck",
  "one_pager",
  "letter_of_intent",
] as const;

const SYSTEM = `You are Kreto's Studio Outcome Router. The user is inside a Studio (a project workspace) and just told you what they want to make. Decide the OUTCOME to spin up and respond by calling the route_outcome tool.

Outcomes you can return:
- make_document  : user wants a deck/proposal/treatment/rate card/moodboard/one-pager/letter of intent. Pick doc_intent from: sponsor_deck, pitch_deck, business_plan, client_proposal, treatment, rate_card, moodboard_deck, one_pager, letter_of_intent. Choose letter_of_intent when the user says "LOI", "letter of intent", "letterhead", "formal letter", or describes writing to a government body / partner / sponsor as a signed letter (not a deck).
- find_people    : looking for collaborators, talent, vendors, suppliers, crew. (e.g. "find a videographer in Bali")
- find_gigs      : looking for paid work, sponsors, opportunities for this project.
- draft_invoice  : "send a quote", "invoice the client", "bill them for X".
- chat           : open-ended question, planning, brainstorming — opens Thrive Copilot pre-filled.

Rules:
- pick exactly ONE outcome.
- doc_intent is REQUIRED when outcome === make_document, else null.
- refined_brief: a clean, 1-3 sentence brief the engine should use. Strip filler ("make me", "can you"), keep specifics (audience, tone, deadline, numbers).
- preview: ONE warm sentence (≤100 chars) confirming what you're about to do. No emojis. No quotes.
- target_query: refined search query for find_people / find_gigs (else null).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt, project_title } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 12000);
    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ac.signal,
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GEMINI_FLASH_LITE,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Studio: "${(project_title || "Untitled").slice(0, 80)}"\n\nUser said: ${prompt.trim().slice(0, 600)}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "route_outcome",
              description: "Return the routing decision.",
              parameters: {
                type: "object",
                properties: {
                  outcome: {
                    type: "string",
                    enum: ["make_document", "find_people", "find_gigs", "draft_invoice", "chat"],
                  },
                  doc_intent: {
                    type: ["string", "null"],
                    enum: [...DOC_INTENTS, null],
                  },
                  refined_brief: { type: "string" },
                  target_query: { type: ["string", "null"] },
                  preview: { type: "string" },
                },
                required: ["outcome", "doc_intent", "refined_brief", "target_query", "preview"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "route_outcome" } },
        }),
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.error("route-studio-outcome gateway fetch failed", fetchErr);
      // Graceful fallback — open chat with the prompt prefilled.
      return new Response(
        JSON.stringify({
          outcome: "chat",
          doc_intent: null,
          refined_brief: prompt.trim(),
          target_query: null,
          preview: "Let's talk it through.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeoutId);

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Workspace AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({
        outcome: "chat", doc_intent: null, refined_brief: prompt.trim(), target_query: null,
        preview: "Let's talk it through.",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("route-studio-outcome error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
