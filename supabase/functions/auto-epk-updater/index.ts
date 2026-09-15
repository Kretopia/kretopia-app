// Auto EPK Updater — analyzes profile + recent credits/projects and emits refresh suggestions.
// Triggered on demand: { user_id? } (defaults to caller). Cron-friendly when called with service key.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function processUser(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, primary_role, bio, site_headline, skills, location")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "no_profile" };

  // Recent credits added in last 30d
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: credits } = await supabase
    .from("thrive_credits")
    .select("id, project_title, role, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!credits?.length) return { ok: true, reason: "no_recent_credits", suggestions: [] };

  const tools = [{
    type: "function",
    function: {
      name: "emit_epk_refresh",
      description: "Emit EPK refresh suggestions",
      parameters: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["bio", "headline", "featured_credit", "rate_card", "reel", "reviews", "stats"] },
                suggested_value: { type: "string" },
                reason: { type: "string" },
              },
              required: ["kind", "suggested_value", "reason"],
            },
          },
        },
        required: ["suggestions"],
      },
    },
  }];

  if (!LOVABLE_API_KEY) return { ok: false, reason: "no_ai" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a creator's PR manager. Suggest concise, high-impact EPK updates based on new credits. Be specific. Never invent facts beyond what's provided." },
        {
          role: "user",
          content: `Creator: ${profile.display_name} (${profile.primary_role})\nCurrent headline: ${profile.site_headline || "—"}\nCurrent bio: ${(profile.bio || "").slice(0, 500)}\n\nNew credits (last 30d):\n${credits.map((c: any) => `- ${c.role || "Contributor"} on "${c.project_title}"`).join("\n")}\n\nReturn 2-4 EPK refresh suggestions (bio rewrite, headline tweak, featured credit pick).`,
        },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "emit_epk_refresh" } },
    }),
  });

  if (!res.ok) return { ok: false, reason: "ai_failed" };
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const parsed = args ? JSON.parse(args) : { suggestions: [] };

  const rows = (parsed.suggestions || []).slice(0, 4).map((s: any) => ({
    user_id: userId,
    kind: s.kind,
    current_value: s.kind === "bio" ? profile.bio : s.kind === "headline" ? profile.site_headline : null,
    suggested_value: s.suggested_value,
    reason: s.reason,
    trigger_event: `new_credits:${credits.length}`,
  }));

  if (rows.length) {
    await supabase.from("epk_refresh_suggestions").insert(rows);
  }
  return { ok: true, suggestions: rows };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    let userId = body.user_id;

    if (!userId) {
      const auth = req.headers.get("authorization");
      if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      userId = u?.user?.id;
    }
    if (!userId) return new Response(JSON.stringify({ error: "no_user" }), { status: 400, headers: corsHeaders });

    const rateLimit = await checkAiFeatureRateLimit(supabase, userId, "auto-epk-updater");
    if (!rateLimit.allowed) return rateLimit.response;

    const result = await processUser(supabase, userId);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
