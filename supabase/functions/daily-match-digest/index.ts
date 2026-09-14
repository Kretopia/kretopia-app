// Daily Match Digest — generates personalized match + gig + sponsor signal payload per user.
// Triggered via cron (08:00 UTC). Also callable per-user with { user_id } for on-demand.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function generateForUser(supabase: any, userId: string) {
  // Pull profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, primary_role, sub_roles, skills, location, country, bio, account_type")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return null;

  // Recent gigs (last 7d, open)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: gigs } = await supabase
    .from("opportunities")
    .select("id, title, description, location, compensation, tags, created_at")
    .eq("status", "open")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(40);

  // Top suggested creators (simple: same primary_role or overlapping skills, exclude self & connected)
  const { data: candidates } = await supabase
    .from("profiles")
    .select("user_id, display_name, primary_role, skills, location, avatar_url")
    .neq("user_id", userId)
    .eq("profile_visibility", "public")
    .limit(80);

  const userSkills: string[] = Array.isArray(profile.skills) ? profile.skills : [];
  const skillSet = new Set(userSkills.map((s: any) => String(s).toLowerCase()));

  const ranked = (candidates || [])
    .map((c: any) => {
      const cs: string[] = Array.isArray(c.skills) ? c.skills : [];
      const overlap = cs.filter((s) => skillSet.has(String(s).toLowerCase())).length;
      const roleMatch = c.primary_role === profile.primary_role ? 25 : 0;
      const score = Math.min(100, overlap * 12 + roleMatch + 30);
      return { ...c, score };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  // AI rank gigs (best 3) if we have key
  let topGigs = (gigs || []).slice(0, 3).map((g: any) => ({ ...g, fit: 70, why: "Recent posting" }));
  if (LOVABLE_API_KEY && gigs?.length) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GEMINI_FLASH,
          messages: [
            { role: "system", content: "You rank gig opportunities for a creator. Return JSON only." },
            {
              role: "user",
              content: `Creator: ${profile.primary_role || ""} | Skills: ${userSkills.slice(0, 10).join(", ")} | Location: ${profile.location || profile.country || ""}.\n\nRank the TOP 3 gigs from this list and return JSON: {"picks":[{"id":"...","fit":0-100,"why":"one short sentence"}]}\n\nGIGS:\n${gigs.slice(0, 20).map((g: any) => `- ${g.id} :: ${g.title} :: ${(g.description || "").slice(0, 140)} :: ${(g.tags || []).join(",")}`).join("\n")}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const j = await res.json();
        const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
        if (Array.isArray(parsed.picks)) {
          topGigs = parsed.picks
            .map((p: any) => {
              const g = gigs.find((x: any) => x.id === p.id);
              return g ? { ...g, fit: p.fit, why: p.why } : null;
            })
            .filter(Boolean)
            .slice(0, 3);
        }
      }
    } catch (e) {
      console.error("AI rank error", e);
    }
  }

  const payload = {
    matches: ranked,
    gigs: topGigs,
    generated_for: profile.display_name,
    summary: `${ranked.length} new creators · ${topGigs.length} gigs picked for you`,
  };

  const { error } = await supabase.from("opportunity_intel_digests").insert({
    user_id: userId,
    kind: "daily_match",
    payload,
  });
  if (error) console.error("insert digest error", error);
  return payload;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let body: any = {};
    try { body = await req.json(); } catch {}

    // On-demand single user. Was a real IDOR + unmetered-AI-cost gap: no
    // getUser()/getClaims() check anywhere, running on the service_role
    // client, so any anon-key holder could pass an arbitrary victim's
    // user_id and get that victim's profile read, an AI ranking call
    // burned against LOVABLE_API_KEY, and a row inserted into
    // opportunity_intel_digests attributed to them. Both real frontend
    // callers (OpportunityIntelCard.tsx, Intel.tsx) already pass their
    // own id and already send their session JWT via
    // supabase.functions.invoke, so requiring it here changes nothing
    // for them. Also gated by the shared per-user AI rate limit --
    // count-only today (see 20260910160000's own TODO on real values).
    if (body?.user_id) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authedClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claimsData, error: claimsErr } = await authedClient.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const callerId = claimsData?.claims?.sub as string | undefined;
      if (claimsErr || !callerId || callerId !== body.user_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rateLimit = await checkAiFeatureRateLimit(supabase, callerId, "daily-match-digest");
      if (!rateLimit.allowed) return rateLimit.response;

      const payload = await generateForUser(supabase, body.user_id);
      return new Response(JSON.stringify({ ok: true, payload }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron/admin-only batch path.
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;

    // Cron: process active users (last login in 30d)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: users } = await supabase
      .from("profiles")
      .select("user_id")
      .gte("last_active_date", since.slice(0, 10))
      .limit(500);

    let count = 0;
    for (const u of users || []) {
      try {
        await generateForUser(supabase, u.user_id);
        count++;
      } catch (e) { console.error("user fail", u.user_id, e); }
    }
    return new Response(JSON.stringify({ ok: true, processed: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
