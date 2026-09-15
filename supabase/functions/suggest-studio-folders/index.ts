// Kreto clusters a user's Studio projects into 2-5 themed folders.
// Returns: { suggestions: [{ name, color, project_ids[], reason }] }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization") || "";
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = await checkAiFeatureRateLimit(supabase, user.id, "suggest-studio-folders");
    if (!rateLimit.allowed) return rateLimit.response;

    // Pull projects owned by the user that aren't already filed
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, description, client_name, workspace_type, status, mood, studio_folder_id")
      .eq("created_by", user.id)
      .order("updated_at", { ascending: false })
      .limit(60);

    const { data: existingFolders } = await supabase
      .from("studio_folders")
      .select("id, name")
      .eq("user_id", user.id);

    const candidates = (projects || []).filter((p) => !p.studio_folder_id);
    if (candidates.length < 2) {
      return new Response(JSON.stringify({ suggestions: [], reason: "Not enough unfiled projects to cluster yet." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectsForAI = candidates.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.workspace_type || "general",
      client: p.client_name || null,
      summary: (p.description || "").slice(0, 220),
      status: p.status,
    }));

    const existingNames = (existingFolders || []).map((f) => f.name).join(", ") || "(none yet)";

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are Kreto, the Executive Producer inside Kretopia. Cluster the user's creative Studio projects into 2-5 short, human folder names a creative would actually use (e.g. 'Client Work', '2026 Campaigns', 'Music Releases', 'Personal Films', 'Brand Partners', 'Wedding Season'). Prefer client/brand groupings, work-type, or season/year if obvious. Avoid generic 'Misc'. Each project belongs to exactly one folder. Skip projects that don't fit anywhere. Reuse an existing folder name if it clearly fits.",
          },
          {
            role: "user",
            content:
              `EXISTING FOLDERS: ${existingNames}\n\nPROJECTS:\n${JSON.stringify(projectsForAI, null, 2)}\n\nReturn JSON only, no prose.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_folders",
              description: "Propose folder groupings for the user's Studio projects.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Short folder name, 1-3 words" },
                        color: {
                          type: "string",
                          enum: ["teal", "magenta", "yellow", "green", "blue", "purple"],
                        },
                        project_ids: {
                          type: "array",
                          items: { type: "string" },
                        },
                        reason: { type: "string", description: "Why these belong together. 1 short sentence." },
                      },
                      required: ["name", "project_ids", "reason"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_folders" } },
      }),
    });

    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limit, try again in a moment" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI failed: " + (await r.text()));
    }

    const j = await r.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { suggestions: [] };

    // Filter to valid project ids only
    const validIds = new Set(candidates.map((p) => p.id));
    const titleById = new Map(candidates.map((p) => [p.id, p.title]));
    const suggestions = (args.suggestions || [])
      .map((s: any) => ({
        name: String(s.name || "").slice(0, 40),
        color: s.color || "teal",
        reason: s.reason || "",
        projects: (s.project_ids || [])
          .filter((id: string) => validIds.has(id))
          .map((id: string) => ({ id, title: titleById.get(id) })),
      }))
      .filter((s: any) => s.name && s.projects.length > 0);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
