import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { roomSessionExpiry } from "../_shared/roomSessionLimits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

// Caps per format — must mirror src/lib/eventFormats.ts
const FORMAT_CAPS: Record<string, { max: number; audienceOnCam: boolean }> = {
  group_room: { max: 50, audienceOnCam: true },
  stage: { max: 500, audienceOnCam: false },
  watch_party: { max: 500, audienceOnCam: false },
  podcast: { max: 6, audienceOnCam: true },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { event_id, user_name, mode } = await req.json();
    const isTestMode = mode === "test";
    if (!event_id || typeof event_id !== "string") {
      return new Response(JSON.stringify({ error: "event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the event (service role — RLS would also allow for public events)
    const { data: event, error: eventErr } = await admin
      .from("creative_jams")
      .select(
        "id, title, created_by, event_mode, online_format, online_max_attendees, recording_enabled, video_room_url",
      )
      .eq("id", event_id)
      .maybeSingle();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.event_mode === "irl") {
      return new Response(
        JSON.stringify({ error: "This event isn't online" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!event.online_format) {
      return new Response(
        JSON.stringify({ error: "Event is missing an online format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Role: host (owner or co-host) vs attendee — compute first so we can gate test mode
    const isOwner = event.created_by === userId;
    let isCoHost = false;
    if (!isOwner) {
      const { data: ch } = await admin
        .from("event_co_hosts")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("user_id", userId)
        .maybeSingle();
      isCoHost = !!ch;
    }
    const isHost = isOwner || isCoHost;

    if (isTestMode) {
      if (!isHost) {
        return new Response(
          JSON.stringify({ error: "Only hosts can open the soundcheck room" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // RSVP / ticket gate (skipped for host soundcheck)
      const { data: canJoin, error: gateErr } = await admin.rpc("can_join_event_online", {
        _event_id: event_id,
        _user_id: userId,
      });
      if (gateErr) {
        console.error("[create-event-room] gate err", gateErr);
        return new Response(JSON.stringify({ error: "Access check failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!canJoin) {
        return new Response(
          JSON.stringify({ error: "RSVP or ticket required to join this room" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const formatCfg = FORMAT_CAPS[event.online_format] ?? FORMAT_CAPS.group_room;
    const cap = Math.min(
      formatCfg.max,
      Math.max(2, event.online_max_attendees || formatCfg.max),
    );

    // Daily room name (max 41 chars, lowercase + dash). Test mode uses a separate room.
    const baseId = event_id.replace(/-/g, "").slice(0, 28).toLowerCase();
    const roomName = isTestMode ? `evt-${baseId}` : `ev-${baseId}`;
    // Test mode keeps its own short 1h soundcheck expiry; production mode
    // previously used 6h here (out of step with the rest of the room
    // creators) and now uses the shared ceiling instead. See
    // _shared/roomSessionLimits.ts for the full previously-inconsistent list.
    const exp = isTestMode ? Math.floor(Date.now() / 1000) + 60 * 60 : roomSessionExpiry();

    // Stage / watch party: audience joins muted + cam off, hosts can promote.
    // Group room / podcast: everyone joins normally.
    const audienceLockedDown = !formatCfg.audienceOnCam;

    const roomProperties: Record<string, unknown> = {
      exp,
      max_participants: cap,
      enable_chat: true,
      enable_screenshare: true,
      enable_knocking: false,
      enable_prejoin_ui: false,
      start_video_off: audienceLockedDown,
      start_audio_off: audienceLockedDown,
    };

    async function createRoom(name: string) {
      return fetch(`${DAILY_API}/rooms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, privacy: "private", properties: roomProperties }),
      });
    }

    let roomUrl: string | null = null;
    const createRes = await createRoom(roomName);
    if (createRes.ok) {
      const room = await createRes.json();
      roomUrl = room.url;
    } else {
      const errText = await createRes.text();
      let errJson: any = {};
      try { errJson = JSON.parse(errText); } catch (_) {}
      const exists = createRes.status === 409 ||
        (typeof errJson?.info === "string" && errJson.info.toLowerCase().includes("already exist"));
      if (exists) {
        // PATCH to keep config fresh, then GET
        const patchRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${DAILY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: roomProperties }),
        });
        if (patchRes.ok) {
          const room = await patchRes.json();
          roomUrl = room.url;
        } else {
          const getRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
          });
          if (getRes.ok) {
            const room = await getRes.json();
            roomUrl = room.url;
          } else {
            throw new Error(`Daily room not retrievable: ${getRes.status}`);
          }
        }
      } else {
        console.error("[create-event-room] Daily create failed:", createRes.status, errText);
        throw new Error(`Daily create failed: ${createRes.status}`);
      }
    }

    if (!roomUrl) throw new Error("No room URL returned");
    const actualRoomName = roomUrl.split("/").pop() || roomName;

    // Meeting token — hosts get owner privileges; audience in stage/watch_party
    // gets a low-permission token that joins muted/cam off.
    const tokenProps: Record<string, unknown> = {
      room_name: actualRoomName,
      user_name: user_name || "Guest",
      user_id: userId,
      exp,
      is_owner: isHost,
    };
    if (audienceLockedDown && !isHost) {
      tokenProps.start_video_off = true;
      tokenProps.start_audio_off = true;
    }

    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: tokenProps }),
    });
    if (!tokenRes.ok) {
      const te = await tokenRes.text();
      throw new Error(`Daily token failed: ${tokenRes.status} ${te}`);
    }
    const { token: meetingToken } = await tokenRes.json();

    // Persist room url on event when host actually goes live (not in test mode)
    if (isHost && !isTestMode) {
      await admin
        .from("creative_jams")
        .update({
          video_room_url: roomUrl,
          video_room_started_at: new Date().toISOString(),
          video_room_started_by: userId,
        })
        .eq("id", event_id);
    }

    return new Response(
      JSON.stringify({
        room_url: roomUrl,
        room_name: actualRoomName,
        token: meetingToken,
        is_host: isHost,
        format: event.online_format,
        test_mode: isTestMode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("[create-event-room]", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
