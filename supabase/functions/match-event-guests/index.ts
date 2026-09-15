import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Guest {
  user_id: string;
  full_name: string;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
  professional_skills?: any;
  passion_skills?: any;
  answers?: Array<{ question: string; value: any }>;
}

function extractList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "object") return Object.keys(v);
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event_id, mode } = await req.json();
    const isAuto = mode === "auto";
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Caller-scoped client (for auth check)
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for cross-user reads
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const rateLimit = await checkAiFeatureRateLimit(admin, user.id, "match-event-guests");
    if (!rateLimit.allowed) return rateLimit.response;

    // Verify caller is event host (creator) or project collaborator.
    // Events may exist without a linked project (legacy / failed studio creation),
    // so fall back to creative_jams.created_by.
    const { data: eventRow } = await admin
      .from("creative_jams")
      .select("id, created_by")
      .eq("id", event_id)
      .maybeSingle();
    if (!eventRow) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let isHost = eventRow.created_by === user.id;
    if (!isHost) {
      const { data: project } = await admin
        .from("projects")
        .select("id, created_by")
        .eq("event_id", event_id)
        .maybeSingle();
      if (project) {
        isHost = project.created_by === user.id;
        if (!isHost) {
          const { data: collab } = await admin
            .from("project_collaborators")
            .select("id").eq("project_id", project.id).eq("user_id", user.id).maybeSingle();
          isHost = !!collab;
        }
      }
      // Also allow event co-hosts
      if (!isHost) {
        const { data: cohost } = await admin
          .from("event_cohosts")
          .select("user_id").eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
        isHost = !!cohost;
      }
    }

    if (isAuto) {
      // Auto-refresh path: any RSVP'd guest can trigger; rate-limit to once per 60s per event.
      const { data: lastRow } = await admin
        .from("event_guest_matches")
        .select("created_at")
        .eq("event_id", event_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastRow?.created_at) {
        const ageMs = Date.now() - new Date(lastRow.created_at).getTime();
        if (ageMs < 60_000) {
          return new Response(JSON.stringify({ ok: true, skipped: "throttled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      // Confirm caller actually RSVP'd
      const { data: part } = await admin
        .from("jam_participants")
        .select("user_id").eq("jam_id", event_id).eq("user_id", user.id).maybeSingle();
      if (!isHost && !part) {
        return new Response(JSON.stringify({ error: "Not authorized" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (!isHost) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull confirmed/going participants (registered users only)
    const { data: parts } = await admin
      .from("jam_participants")
      .select("user_id, status")
      .eq("jam_id", event_id)
      .in("status", ["going", "confirmed", "checked_in"]);

    const userIds = Array.from(new Set((parts || []).map((p: any) => p.user_id).filter(Boolean)));
    if (userIds.length < 2) {
      return new Response(JSON.stringify({ matches: [], note: "Need at least 2 registered guests." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, role, bio, location, professional_skills, passion_skills")
      .in("user_id", userIds);

    // Custom RSVP answers
    const { data: answers } = await admin
      .from("event_rsvp_answers")
      .select("user_id, question_id, answer")
      .eq("event_id", event_id)
      .in("user_id", userIds);
    const { data: questions } = await admin
      .from("event_rsvp_questions")
      .select("id, question")
      .eq("event_id", event_id);
    const qMap = new Map<string, string>((questions || []).map((q: any) => [q.id, q.question]));

    const guests: Guest[] = (profiles || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name || "Guest",
      role: p.role,
      bio: p.bio,
      location: p.location,
      professional_skills: p.professional_skills,
      passion_skills: p.passion_skills,
      answers: (answers || [])
        .filter((a: any) => a.user_id === p.user_id)
        .map((a: any) => ({
          question: qMap.get(a.question_id) || "",
          value: a.answer?.value ?? a.answer,
        })),
    }));

    const promptGuests = guests.slice(0, 30).map((g, i) => {
      const skills = [...extractList(g.professional_skills), ...extractList(g.passion_skills)].slice(0, 12);
      const ans = (g.answers || []).slice(0, 4)
        .map(a => `Q:${a.question} A:${typeof a.value === "string" ? a.value : JSON.stringify(a.value)}`)
        .join(" | ");
      return `${i}. id=${g.user_id} | ${g.full_name} | ${g.role || "creator"} | ${g.location || "—"} | skills:[${skills.join(", ")}] | bio:${(g.bio || "").slice(0, 140)} | rsvp:${ans}`;
    }).join("\n");

    const systemPrompt = `You are an AI matchmaker for an in-person creative event. Your job is to suggest the 8-15 most interesting introductions between attendees who would benefit most from meeting.

Optimize for:
- Complementary creative skills (e.g. director + cinematographer)
- Shared interests/passions
- RSVP intent overlap (what they said they're hoping to find)
- Same-city collaboration potential

Avoid:
- Pairing two people in the exact same role with no complementary angle
- Generic reasons — be specific to their profiles`;

    const userPrompt = `EVENT GUESTS:
${promptGuests}

Generate the strongest 8-15 pair recommendations. Use the EXACT user_id strings provided.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_guest_matches",
            description: "Return suggested guest pairings with score and reasons.",
            parameters: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      user_a_id: { type: "string" },
                      user_b_id: { type: "string" },
                      score: { type: "number" },
                      reasons: { type: "array", items: { type: "string" } },
                      shared_interests: { type: "array", items: { type: "string" } },
                    },
                    required: ["user_a_id", "user_b_id", "score", "reasons"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["matches"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_guest_matches" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      throw new Error("AI gateway error");
    }

    const aiJson = await aiResp.json();
    const tc = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const parsed = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : { matches: [] };
    const userIdSet = new Set(userIds);

    const rows: any[] = [];
    for (const m of parsed.matches as any[]) {
      const a = String(m.user_a_id);
      const b = String(m.user_b_id);
      if (a === b || !userIdSet.has(a) || !userIdSet.has(b)) continue;
      const [ua, ub] = a < b ? [a, b] : [b, a];
      rows.push({
        event_id,
        user_a: ua,
        user_b: ub,
        score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))),
        reasons: Array.isArray(m.reasons) ? m.reasons.slice(0, 5) : [],
        shared_interests: Array.isArray(m.shared_interests) ? m.shared_interests.slice(0, 8) : [],
      });
    }

    if (rows.length > 0) {
      // Refresh: clear existing then insert
      await admin.from("event_guest_matches").delete().eq("event_id", event_id);
      const { error: insErr } = await admin.from("event_guest_matches").insert(rows);
      if (insErr) {
        console.error("insert err", insErr);
        throw insErr;
      }
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length, matches: rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("match-event-guests error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
