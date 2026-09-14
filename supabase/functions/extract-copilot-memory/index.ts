// Thrive Brain — memory extractor.
// Reads recent turns of a Copilot conversation and asks the model
// "Did the user reveal a stable preference, relationship, or fact worth remembering?"
// Embeds + upserts results into copilot_memories. Dedupes by cosine similarity (>0.92 = update).
//
// Called fire-and-forget from thrive-ai-chat after a successful assistant turn.
//
// Auth: requires user JWT (verify_jwt true is fine — user can only trigger their own extraction).

import { createClient } from "npm:@supabase/supabase-js@2";
import { embedText, toPgVector } from "../_shared/embed.ts";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ALLOWED_KINDS = new Set([
  "fact",
  "preference",
  "relationship",
  "working_style",
  "money",
  "project",
  "goal",
  "dislike",
]);

const SYSTEM_PROMPT = `You extract long-term memories about a user from their chat with Thrive Copilot.
A memory is a STABLE fact that will still be true next week — preferences, working style, recurring collaborators, money habits, goals, things they dislike.

NEVER store:
- Greetings, throwaway chitchat, or one-off questions
- Things the assistant said about them (only what THE USER revealed)
- Today-only context ("I'm tired today") or transient state
- Sensitive identifiers (passwords, full card numbers, SSNs)
- Anything you're <80% confident is a real, lasting fact

Output ONLY this JSON shape — no prose, no fences:
{ "memories": [
  { "kind": "preference|relationship|working_style|money|project|goal|dislike|fact",
    "content": "<one tight sentence in third person, e.g. 'Prefers morning calls before 11am'>",
    "confidence": 0.0-1.0 }
] }

If nothing memorable happened, return { "memories": [] }. Max 3 memories per call.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (uErr || !userId) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId: string | undefined = body.conversation_id;
    if (!conversationId) return json({ error: "conversation_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Pull last 6 turns (3 exchanges)
    const { data: turns } = await admin
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(6);
    if (!turns?.length) return json({ ok: true, extracted: 0, reason: "no turns" });

    const transcript = [...turns]
      .reverse()
      .map((t: any) => `${t.role.toUpperCase()}: ${String(t.content).slice(0, 1200)}`)
      .join("\n\n");

    // Ask the model
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH_LITE,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Recent turns:\n\n${transcript}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResp.status === 429) return json({ ok: true, extracted: 0, reason: "rate_limited" });
    if (aiResp.status === 402) return json({ ok: true, extracted: 0, reason: "credits_exhausted" });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.warn("extract LLM error", aiResp.status, t.slice(0, 200));
      return json({ ok: true, extracted: 0, reason: "llm_error" });
    }

    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { memories?: Array<{ kind?: string; content?: string; confidence?: number }> } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("extract: invalid JSON", raw.slice(0, 200));
      return json({ ok: true, extracted: 0, reason: "invalid_json" });
    }

    const candidates = (parsed.memories ?? [])
      .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 4)
      .slice(0, 3);
    if (!candidates.length) return json({ ok: true, extracted: 0 });

    let saved = 0;
    let updated = 0;

    for (const cand of candidates) {
      const kind = ALLOWED_KINDS.has(cand.kind ?? "") ? (cand.kind as string) : "fact";
      const content = cand.content!.trim().slice(0, 600);
      const confidence = Math.max(0, Math.min(1, Number(cand.confidence ?? 0.7)));
      if (confidence < 0.6) continue;

      const embedding = await embedText(content);
      if (!embedding) continue;

      // Dedupe: find very similar existing memory
      const { data: dupes } = await admin.rpc("match_copilot_memories", {
        p_user_id: userId,
        p_query_embedding: toPgVector(embedding) as unknown as number[],
        p_match_count: 1,
        p_min_similarity: 0.88,
      });
      const dupe = Array.isArray(dupes) && dupes[0];

      if (dupe) {
        // Bump confidence + refresh content if the new one is longer
        const newConf = Math.min(1, (dupe.confidence ?? 0.7) + 0.05);
        await admin
          .from("copilot_memories")
          .update({
            confidence: newConf,
            content: content.length > (dupe.content?.length ?? 0) ? content : dupe.content,
            last_used_at: new Date().toISOString(),
            use_count: (dupe.use_count ?? 0) + 1,
          })
          .eq("id", dupe.id)
          .eq("user_id", userId);
        updated++;
      } else {
        await admin.from("copilot_memories").insert({
          user_id: userId,
          kind,
          content,
          confidence,
          source: `chat:${conversationId}`,
          embedding: toPgVector(embedding),
        });
        saved++;
      }
    }

    return json({ ok: true, extracted: saved, updated });
  } catch (e) {
    console.error("extract-copilot-memory error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
