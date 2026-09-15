import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const eventId = body?.event_id as string | undefined;
    const projectId = body?.project_id as string | undefined;
    if (!eventId) {
      return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: event, error: evErr } = await admin
      .from("creative_jams")
      .select("id, title, description, category, venue_name, start_time, end_time, created_by")
      .eq("id", eventId)
      .single();
    if (evErr || !event) throw evErr ?? new Error("Event not found");
    if (event.created_by !== user.id) {
      return new Response(JSON.stringify({ error: "Only host can generate recap" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ count: attendeeCount }, { data: sponsors }, { data: suppliers }, { data: talent }] = await Promise.all([
      admin.from("jam_participants").select("*", { count: "exact", head: true }).eq("jam_id", eventId).in("status", ["going", "checked_in"]),
      admin.from("event_sponsors").select("name, package_value, deliverables, stage").eq("event_id", eventId),
      admin.from("event_suppliers").select("name, category").eq("event_id", eventId),
      admin.from("event_talent").select("name, role").eq("event_id", eventId),
    ]);

    const sponsorList = (sponsors ?? []).filter((s: any) => ["confirmed", "delivered"].includes(s.stage));

    const prompt = `You are an event recap writer for a creative platform. Generate a JSON object with these keys:
- recap_caption: A short, warm social-media caption (max 280 chars, 2-3 emojis ok) thanking attendees and sponsors.
- sponsor_recap_md: A markdown report (~250 words) for sponsors covering attendance, key moments, and ROI talking points.
- highlight_suggestions: An array of 4-6 short strings — ideas for highlight reels / clip moments to capture from photos/video.
- thank_you_drafts: An array of 3 short message drafts ({audience, message}) for: attendees, sponsors, suppliers/talent.

Event:
- Title: ${event.title}
- Category: ${event.category}
- Venue: ${event.venue_name ?? "n/a"}
- Description: ${event.description ?? ""}
- Attendees: ${attendeeCount ?? 0}
- Confirmed sponsors: ${sponsorList.map((s: any) => s.name).join(", ") || "none"}
- Suppliers: ${(suppliers ?? []).map((s: any) => `${s.name} (${s.category})`).join(", ") || "none"}
- Talent: ${(talent ?? []).map((t: any) => `${t.name} (${t.role})`).join(", ") || "none"}

Return ONLY raw JSON, no markdown fences.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI generation failed", detail: txt }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const upsertPayload = {
      event_id: eventId,
      project_id: projectId ?? null,
      recap_caption: parsed.recap_caption ?? null,
      sponsor_recap_md: parsed.sponsor_recap_md ?? null,
      highlight_suggestions: parsed.highlight_suggestions ?? [],
      thank_you_drafts: parsed.thank_you_drafts ?? [],
      status: "draft",
      generated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = await admin
      .from("event_recap_drafts")
      .upsert(upsertPayload, { onConflict: "event_id" })
      .select()
      .single();
    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ ok: true, recap: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
