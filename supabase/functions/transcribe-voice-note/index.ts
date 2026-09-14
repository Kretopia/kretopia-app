import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, audio_url, table } = await req.json();

    if (!message_id || !audio_url) {
      return new Response(
        JSON.stringify({ error: "message_id and audio_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Whitelist tables we can write a transcript back to
    const allowedTables: Record<string, string> = {
      messages: "voice_note_transcript",
      project_messages: "voice_transcript",
    };
    const targetTable = allowedTables[table as string] ? (table as string) : "messages";
    const transcriptColumn = allowedTables[targetTable];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Download the audio file from its public URL
    const audioResp = await fetch(audio_url);
    if (!audioResp.ok) {
      throw new Error(`Failed to fetch audio: ${audioResp.status}`);
    }
    const audioBuffer = await audioResp.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(audioBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );

    // Send to Gemini for transcription
    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_FLASH,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcribe this voice note exactly. Return only the transcription text, no preamble or commentary. If the audio is silent or unintelligible, return an empty string.",
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: "webm",
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const transcript: string =
      aiData.choices?.[0]?.message?.content?.trim() || "";

    // Update the message row in the correct table
    const { error: updateError } = await supabase
      .from(targetTable)
      .update({ [transcriptColumn]: transcript })
      .eq("id", message_id);

    if (updateError) {
      console.error("Failed to update message:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("transcribe-voice-note error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
