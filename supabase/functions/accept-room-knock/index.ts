// Owner accepts (or declines) a pending knock. On accept we create a Daily
// room via the existing create-meeting pipeline and stamp the knock with a
// guest-joinable share URL.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { roomSessionExpiry } from "../_shared/roomSessionLimits.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAILY_API = "https://api.daily.co/v1";

interface Body {
  knock_id: string;
  action: "accept" | "decline";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const user = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await user.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { knock_id, action } = (await req.json()) as Body;
    if (!knock_id || !["accept", "decline"].includes(action)) {
      return json({ error: "Bad request" }, 400);
    }

    const { data: knock, error: kErr } = await admin
      .from("room_knocks")
      .select("*")
      .eq("id", knock_id)
      .maybeSingle();
    if (kErr || !knock) return json({ error: "Knock not found" }, 404);
    if (knock.owner_id !== userId) return json({ error: "Forbidden" }, 403);
    if (knock.status !== "pending") return json({ error: "Already handled" }, 409);

    if (action === "decline") {
      await admin
        .from("room_knocks")
        .update({ status: "declined" })
        .eq("id", knock_id);
      return json({ ok: true });
    }

    // Accept — create Daily room
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");
    const exp = roomSessionExpiry(); // shared ceiling — see _shared/roomSessionLimits.ts
    const roomName = `room-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

    const roomRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          max_participants: 8,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: false,
          enable_prejoin_ui: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    if (!roomRes.ok) throw new Error(`Daily room: ${roomRes.status}`);
    const room = await roomRes.json();

    const { data: meeting, error: mErr } = await admin
      .from("meetings")
      .insert({
        host_id: userId,
        source: "adhoc",
        title: `Room with ${knock.guest_name}`,
        room_name: roomName,
        room_url: room.url,
        started_at: new Date().toISOString(),
        max_participants: 8,
        recording_enabled: false,
        transcript_enabled: false,
        knocking_enabled: false,
      })
      .select("id, share_token, room_url")
      .single();
    if (mErr) throw mErr;

    const appUrl = Deno.env.get("APP_URL") || "https://www.thrivein.io";
    const shareUrl = `${appUrl}/meet/${meeting.id}?t=${meeting.share_token}`;

    await admin
      .from("room_knocks")
      .update({
        status: "accepted",
        meeting_id: meeting.id,
        share_url: shareUrl,
      })
      .eq("id", knock_id);

    return json({
      ok: true,
      meeting_id: meeting.id,
      share_url: shareUrl,
      room_url: meeting.room_url,
    });
  } catch (e) {
    console.error("[accept-room-knock]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
