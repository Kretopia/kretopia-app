// Creates (or mints token for) the shared Daily room used in GROUP mode.
// Idempotent: stores group_room_url on speed_sessions.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { roomSessionExpiry } from "../_shared/roomSessionLimits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const t = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(t);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;
    const body = await req.json().catch(() => ({}));
    const session_id: string = body.session_id;
    const user_name: string = String(body.user_name ?? "Guest").slice(0, 60);
    if (!session_id) throw new Error("session_id required");

    // Auth: must be host or have RSVP'd
    const { data: sess } = await admin
      .from("speed_sessions")
      .select("id, host_user_id, fallback_mode, group_room_url, mode, duration_min")
      .eq("id", session_id).maybeSingle();
    if (!sess) throw new Error("session not found");

    const isHost = sess.host_user_id === userId;
    if (!isHost) {
      const { data: rsvp } = await admin
        .from("speed_session_rsvps").select("user_id").eq("session_id", session_id).eq("user_id", userId).maybeSingle();
      if (!rsvp) throw new Error("not RSVP'd");
    }

    // Create room once
    let roomUrl = sess.group_room_url;
    let roomName = roomUrl ? roomUrl.split("/").pop()! : `sp-${crypto.randomUUID().replace(/-/g, "").slice(0, 30)}`;
    if (!roomUrl) {
      const exp = Math.floor(Date.now() / 1000) + (sess.duration_min ?? 60) * 60 + 30 * 60;
      const cr = await fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          privacy: "private",
          properties: {
            exp,
            max_participants: 50,
            enable_chat: true,
            enable_screenshare: sess.mode !== "audio",
            enable_knocking: false,
            enable_prejoin_ui: false,
            start_video_off: sess.mode === "audio",
            start_audio_off: false,
          },
        }),
      });
      if (!cr.ok) throw new Error(`daily room: ${await cr.text()}`);
      const r = await cr.json();
      roomUrl = r.url;
      await admin.from("speed_sessions").update({ group_room_url: roomUrl }).eq("id", session_id);
    }

    // Mint short-lived meeting token
    const tokRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name,
          user_id: userId,
          is_owner: isHost,
          exp: roomSessionExpiry(), // shared ceiling — see _shared/roomSessionLimits.ts
        },
      }),
    });
    if (!tokRes.ok) throw new Error(`daily token: ${await tokRes.text()}`);
    const { token } = await tokRes.json();

    return new Response(JSON.stringify({ room_url: roomUrl, room_name: roomName, token }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-speed-group-room]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
