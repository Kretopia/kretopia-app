import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Collaborator {
  id: string;
  full_name: string;
}

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
      collaborators = [],
      today_iso,
      project_title,
    }: {
      audio_base64: string;
      mime_type?: string;
      collaborators?: Collaborator[];
      today_iso?: string;
      project_title?: string;
    } = await req.json();

    if (!audio_base64) {
      return new Response(JSON.stringify({ error: "audio_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = today_iso || new Date().toISOString().slice(0, 10);

    const collabList = collaborators.length
      ? collaborators.map((c) => `- ${c.full_name} (id: ${c.id})`).join("\n")
      : "(no collaborators — assignee must be null)";

    const systemPrompt = `You convert a short voice memo from a creative professional into a single project task.
Today is ${today}.
${project_title ? `Project: "${project_title}".` : ""}

Available collaborators (only use these exact ids for assignee_user_id, otherwise null):
${collabList}

Rules:
- Transcribe first, then extract.
- title: a concise actionable task (max 80 chars). Imperative voice ("Send brief to Sarah", "Edit reel cut 3"). Do NOT include the assignee name in the title if they are being assigned.
- description: optional extra detail from the memo. Null if title already captures it.
- due_date: ISO date YYYY-MM-DD. Resolve relative phrases ("tomorrow", "next Friday", "in 2 days") against today's date. Null if no date mentioned.
- assignee_user_id: match spoken names against the collaborator list (fuzzy, first-name OK). Null if no name said or no match.
- transcript: the raw transcription of what was said.
Always call the create_task tool. Never reply in plain text.`;

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
              { type: "text", text: "Here is my voice memo. Create the task." },
              {
                type: "input_audio",
                input_audio: { data: audio_base64, format: mime_type.includes("mp3") ? "mp3" : "webm" },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_task",
              description: "Create a single task from the transcribed voice memo.",
              parameters: {
                type: "object",
                properties: {
                  transcript: { type: "string", description: "Raw transcription of the audio." },
                  title: { type: "string", description: "Concise task title, max 80 chars." },
                  description: { type: ["string", "null"], description: "Optional extra detail." },
                  due_date: {
                    type: ["string", "null"],
                    description: "ISO YYYY-MM-DD or null.",
                  },
                  assignee_user_id: {
                    type: ["string", "null"],
                    description: "Collaborator id or null.",
                  },
                },
                required: ["transcript", "title", "description", "due_date", "assignee_user_id"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_task" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Workspace AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call returned", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Could not extract a task from that audio. Try again." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-to-task error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
