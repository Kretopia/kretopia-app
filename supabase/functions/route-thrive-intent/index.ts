// Classifies a user prompt into a Thrive intent and returns a routing payload.
// No DB writes — pure routing decision used by the conversational Home hero.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `You are Kreto's intent router. A creator types or speaks one short request. You decide what surface or workflow it maps to and reply by calling the route_intent tool.

Intents you can return:
- create_workspace : the user wants to start something (podcast, event, masterclass, content shoot, brand campaign, music release, client project, hiring, EPK). Pick workspace_type from: podcast, event, masterclass, content, campaign, music, client, general.
- find_people     : looking for collaborators, talent, vendors, suppliers ("find me a videographer in Bali", "I need a stage supplier")
- find_gigs       : looking for paid work, gigs, sponsors, jobs, opportunities
- outreach        : draft messages, sponsor outreach, follow-ups, emails
- profile_epk     : work on EPK, bio, portfolio, website, resume
- summarize       : "what's new", "catch me up", "summarize my projects", recap
- chat            : open-ended question or anything that doesn't fit above

Rules:
- pick exactly one intent
- title is a short workspace title only when intent === create_workspace (max 50 chars). Title should be the *thing being made*, not "New podcast project".
- preview is one warm sentence (max 100 chars) confirming what you're about to do — no emojis, no quotes around it.
- target_query is a refined search query for find_people / find_gigs (otherwise null).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hard timeout so the client never hangs on a stuck gateway call.
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 15000);
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
          { role: "user", content: prompt.trim().slice(0, 500) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "route_intent",
            description: "Return the routing decision.",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["create_workspace", "find_people", "find_gigs", "outreach", "profile_epk", "summarize", "chat"],
                },
                workspace_type: { type: ["string", "null"], enum: ["podcast", "event", "masterclass", "content", "campaign", "music", "client", "general", null] },
                title: { type: ["string", "null"] },
                target_query: { type: ["string", "null"] },
                preview: { type: "string" },
              },
              required: ["intent", "workspace_type", "title", "target_query", "preview"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "route_intent" } },
      }),
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const aborted = (fetchErr as any)?.name === "AbortError";
      console.error("route-thrive-intent gateway fetch failed", fetchErr);
      // Graceful fallback so the client never just spins: treat as open chat.
      return new Response(
        JSON.stringify({
          intent: "chat",
          workspace_type: null,
          title: null,
          target_query: null,
          preview: aborted ? "Taking too long — let's talk it through." : "Let's talk it through.",
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
      return new Response(JSON.stringify({ intent: "chat", preview: "Let's talk it through." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("route-thrive-intent error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
