// Create a multi-party meeting room (Daily) + persist a meetings row.
// Supports sources: studio | dm | profile | event | adhoc | circle.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ROOM_SESSION_CEILING_SECONDS } from "../_shared/roomSessionLimits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

type Source = "studio" | "dm" | "profile" | "event" | "adhoc" | "circle";

interface Body {
  source: Source;
  title?: string;
  project_id?: string | null;
  conversation_id?: string | null;
  event_id?: string | null;
  circle_id?: string | null;
  invited_user_ids?: string[];
  scheduled_for?: string | null; // ISO
  max_participants?: number;
  recording_enabled?: boolean;
  transcript_enabled?: boolean;
  knocking_enabled?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    const source: Source = body.source;
    if (!["studio", "dm", "profile", "event", "adhoc", "circle"].includes(source)) {
      return json({ error: "Invalid source" }, 400);
    }

    const max = Math.min(Math.max(body.max_participants ?? 25, 2), 500);
    const recording = body.recording_enabled !== false;
    const transcription = body.transcript_enabled !== false;
    const knocking = body.knocking_enabled !== false;

    // Daily room — exp is the shared session ceiling after scheduled time
    // (or now). See _shared/roomSessionLimits.ts.
    const startSec = body.scheduled_for
      ? Math.floor(new Date(body.scheduled_for).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const exp = startSec + ROOM_SESSION_CEILING_SECONDS;

    const roomName = `mtg-${crypto.randomUUID().replace(/-/g, "").slice(0, 28)}`;
    const roomRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          max_participants: max,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: knocking,
          enable_prejoin_ui: false,
          enable_recording: recording ? "cloud" : undefined,
          enable_transcription_storage: transcription,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    if (!roomRes.ok) throw new Error(`Daily room failed: ${roomRes.status} ${await roomRes.text()}`);
    const room = await roomRes.json();

    // Insert meeting row
    const { data: meeting, error: insErr } = await admin
      .from("meetings")
      .insert({
        host_id: userId,
        source,
        project_id: body.project_id ?? null,
        conversation_id: body.conversation_id ?? null,
        event_id: body.event_id ?? null,
        circle_id: body.circle_id ?? null,
        title: body.title ?? null,
        room_name: roomName,
        room_url: room.url,
        scheduled_for: body.scheduled_for ?? null,
        started_at: body.scheduled_for ? null : new Date().toISOString(),
        max_participants: max,
        recording_enabled: recording,
        transcript_enabled: transcription,
        knocking_enabled: knocking,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    // Add host as participant
    await admin.from("meeting_participants").insert({
      meeting_id: meeting.id,
      user_id: userId,
      role: "host",
      status: "invited",
    });

    // Add invitees
    const invited = (body.invited_user_ids ?? []).filter((id) => id && id !== userId);
    if (invited.length > 0) {
      const rows = invited.map((uid) => ({
        meeting_id: meeting.id,
        user_id: uid,
        role: "attendee" as const,
        status: "invited" as const,
      }));
      await admin.from("meeting_participants").upsert(rows, {
        onConflict: "meeting_id,user_id",
        ignoreDuplicates: true,
      });
    }

    // Mint host token
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_id: userId,
          is_owner: true,
          enable_recording: recording ? "cloud" : undefined,
          exp,
        },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token: hostToken } = await tokenRes.json();

    return json({
      meeting_id: meeting.id,
      room_url: meeting.room_url,
      room_name: meeting.room_name,
      share_token: meeting.share_token,
      host_token: hostToken,
    });
  } catch (e) {
    console.error("[create-meeting]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
