// Thrive Voice — STT + tier gate.
// Records → returns transcript. Brain + TTS now live in the main agent
// (thrive-ai-chat) and thrive-voice-tts so voice inherits every tool/action
// the text agent supports (find_talent, draft_quote, draft_invoice,
// start_video_call, remember_memory, etc).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const STT_MODEL = GEMINI_FLASH;

interface ReqBody {
  audio_base64: string;
  mime_type?: string;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "missing_auth" }, 401);

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "invalid_auth" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const body = (await req.json()) as ReqBody;
    if (!body?.audio_base64) return jsonResponse({ error: "missing_audio" }, 400);

    const audioBytes = base64ToBytes(body.audio_base64);
    if (audioBytes.length === 0) return jsonResponse({ error: "empty_audio" }, 400);
    if (audioBytes.length > 8 * 1024 * 1024) {
      return jsonResponse({ error: "audio_too_large", max_mb: 8 }, 413);
    }

    const mime = body.mime_type || "audio/webm";

    // --- STT via Gemini multimodal (Lovable AI Gateway) ---
    const audioB64In = body.audio_base64.replace(/^data:[^;]+;base64,/, "");
    const sttResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: STT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a strict speech-to-text engine. Output ONLY the verbatim transcript of the audio. No commentary. If the audio is silent or unintelligible, output exactly: <empty>",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio verbatim." },
              {
                type: "input_audio",
                input_audio: { data: audioB64In, format: mime.includes("wav") ? "wav" : "webm" },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });

    if (!sttResp.ok) {
      const err = await sttResp.text();
      console.error("STT failed", sttResp.status, err);
      if (sttResp.status === 429) return jsonResponse({ error: "rate_limited" }, 429);
      if (sttResp.status === 402) return jsonResponse({ error: "ai_credits_exhausted" }, 402);
      return jsonResponse({ error: "stt_failed", detail: err }, 502);
    }
    const sttJson = await sttResp.json();
    const rawTranscript: string = (sttJson?.choices?.[0]?.message?.content || "").trim();
    const transcript = rawTranscript.replace(/^<empty>$/i, "").trim();
    if (!transcript) return jsonResponse({ error: "no_speech_detected" }, 400);

    // --- Tier gate (count seconds against daily cap) ---
    const seconds = Math.max(1, Math.ceil(audioBytes.length / 2000));
    // Must use userClient — consume_voice_seconds reads auth.uid() from the JWT.
    const { data: gate, error: gateErr } = await userClient.rpc("consume_voice_seconds", {
      _seconds: seconds,
    });
    if (gateErr) {
      console.error("voice gate error", gateErr);
      return jsonResponse({ error: "gate_failed", detail: gateErr.message }, 500);
    }
    if (gate && (gate as { ok?: boolean }).ok === false) {
      return jsonResponse(
        { error: "voice_daily_limit", ...(gate as Record<string, unknown>), transcript },
        429,
      );
    }

    return jsonResponse({ ok: true, transcript, usage: gate });
  } catch (e) {
    console.error("voice-turn fatal", e);
    return jsonResponse(
      { error: "internal", detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});
