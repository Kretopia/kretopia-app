import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProjectLite {
  id: string;
  title: string;
}

/**
 * Multi-intent voice command parser. Takes a short voice memo + recent
 * project list and returns a structured action the client can execute.
 *
 * Supported intents:
 *  - add_task        → create task on a project
 *  - mark_paid       → mark latest invoice for a project as paid
 *  - send_invoice    → open invoice composer for a project
 *  - start_call      → start video call on a project
 *  - add_note        → quick note to a project
 *  - jump_project    → navigate to a project
 *  - unknown         → speak it back, do nothing
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const {
      audio_base64,
      mime_type = "audio/webm",
      projects = [],
      today_iso,
    }: {
      audio_base64: string;
      mime_type?: string;
      projects?: ProjectLite[];
      today_iso?: string;
    } = await req.json();

    if (!audio_base64) {
      return new Response(JSON.stringify({ error: "audio_base64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = today_iso || new Date().toISOString().slice(0, 10);
    const projectList = projects.length
      ? projects.map((p) => `- "${p.title}" (id: ${p.id})`).join("\n")
      : "(no projects yet)";

    const systemPrompt = `You are the voice command parser for ThriveDesk — a workspace for creative professionals.
Today: ${today}.

User's recent projects:
${projectList}

Listen, transcribe, then classify the spoken intent into ONE action.
- Match project names fuzzily (first word OK, partial OK). Use null project_id if nothing matches.
- For relative dates ("tomorrow", "Friday"), resolve to ISO YYYY-MM-DD.
- For amounts, normalize to numeric (e.g. "five hundred" → 500).
- Always call the parse_command tool. Never reply in plain text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Parse my voice command." },
              {
                type: "input_audio",
                input_audio: {
                  data: audio_base64,
                  format: mime_type.includes("mp3") ? "mp3" : "webm",
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_command",
              description: "Parse a spoken project command into a structured action.",
              parameters: {
                type: "object",
                properties: {
                  transcript: { type: "string", description: "Raw transcription." },
                  intent: {
                    type: "string",
                    enum: [
                      "add_task",
                      "mark_paid",
                      "send_invoice",
                      "start_call",
                      "add_note",
                      "jump_project",
                      "unknown",
                    ],
                  },
                  project_id: {
                    type: ["string", "null"],
                    description: "Matched project id, or null.",
                  },
                  task_title: { type: ["string", "null"] },
                  due_date: { type: ["string", "null"], description: "ISO date or null." },
                  note: { type: ["string", "null"], description: "Free-form note text." },
                  amount: { type: ["number", "null"] },
                  summary: {
                    type: "string",
                    description: "Friendly one-line summary of what will happen, e.g. 'Mark Acme reel invoice as paid'.",
                  },
                },
                required: ["transcript", "intent", "project_id", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_command" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Workspace AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "Couldn't understand that. Try again." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-command error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
