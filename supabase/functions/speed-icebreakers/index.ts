// Returns 4 short, warm conversation prompts tailored to BOTH people in a pairing.
// Used by the in-call overlay so creators have something to lean on in the first 30 seconds.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK = [
  "What are you working on this month that you're actually excited about?",
  "Where do you wish you had a collaborator right now?",
  "What's the one creative tool you can't live without?",
  "Who should I be following that nobody talks about?",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ prompts: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ prompts: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const me = claims.claims.sub as string;
    const { peer_id, theme } = await req.json();
    if (!peer_id) throw new Error("peer_id required");

    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, role, bio, primary_skills, location")
      .in("user_id", [me, peer_id]);

    const mine = profs?.find((p: any) => p.user_id === me);
    const theirs = profs?.find((p: any) => p.user_id === peer_id);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ prompts: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Generate 4 SHORT (under 14 words each) warm, specific conversation starters two creators can use on a 5-min speed networking video call.

Theme: ${theme || "open creators night"}
ME — role: ${mine?.role || "creator"}, skills: ${(mine?.primary_skills || []).slice(0, 4).join(", ") || "—"}, bio: ${mine?.bio?.slice(0, 160) || "—"}
THEM — name: ${theirs?.full_name || "the other person"}, role: ${theirs?.role || "creator"}, skills: ${(theirs?.primary_skills || []).slice(0, 4).join(", ") || "—"}, bio: ${theirs?.bio?.slice(0, 160) || "—"}, location: ${theirs?.location || "—"}

Rules:
- Specific to THEM when possible (their role/skills/work), not generic.
- Punchy, sounds like a real human in 2026 — no "fellow creative", no "synergy".
- Mix: one ice-breaker, one craft question, one collab opener, one human/fun question.
- Return STRICT JSON: {"prompts": ["...", "...", "...", "..."]} and nothing else.`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH_LITE,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!ai.ok) {
      return new Response(JSON.stringify({ prompts: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const json = await ai.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let prompts: string[] = FALLBACK;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.prompts) && parsed.prompts.length > 0) {
        prompts = parsed.prompts.slice(0, 4).map((s: any) => String(s));
      }
    } catch { /* keep fallback */ }

    return new Response(JSON.stringify({ prompts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[speed-icebreakers]", e);
    return new Response(JSON.stringify({ prompts: FALLBACK }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
