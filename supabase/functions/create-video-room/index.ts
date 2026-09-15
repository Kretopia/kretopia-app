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
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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

    const { project_id, user_name } = await req.json();
    if (!project_id || typeof project_id !== "string") {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access
    const { data: hasAccess } = await admin.rpc("user_has_project_access", {
      project_id_param: project_id,
      user_id_param: userId,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daily room names: max 41 chars, lowercase alphanumeric + dash
    const roomName = `td-${project_id.replace(/-/g, "").slice(0, 30)}`.toLowerCase();
    const exp = roomSessionExpiry(); // shared ceiling — see _shared/roomSessionLimits.ts

    // Properties — keep minimal/free-plan-compatible.
    // NOTE: enable_recording requires a paid Daily plan; we omit it here and
    // toggle recording per-call from the client instead (host control).
    const roomProperties: Record<string, unknown> = {
      exp,
      max_participants: 10,
      enable_chat: true,
      enable_screenshare: true,
      start_video_off: false,
      start_audio_off: false,
      // WhatsApp-style: anyone with a valid token/guest link drops straight in.
      enable_knocking: false,
      enable_prejoin_ui: false,
      // Cloud recording — feeds the daily-recording-webhook → transcribe-call
      // pipeline (Phase 2: Call Intelligence). Audio-only keeps cost low and
      // is all Gemini needs to transcribe.
      enable_recording: "cloud",
      recordings_bucket: undefined,
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
      console.error("[create-video-room] Daily create response:", createRes.status, errText);

      // Daily returns 409 (or invalid-request-error with "already exists") if the room name is taken.
      const alreadyExists =
        createRes.status === 409 ||
        (typeof errJson?.info === "string" && errJson.info.toLowerCase().includes("already exist"));

      if (alreadyExists) {
        // Room exists — PATCH it so its properties match our latest config
        // (e.g., disable knocking/prejoin if they were enabled previously).
        const patchRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
          method: "POST", // Daily uses POST to update room properties
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
          // Fallback: just GET the existing room
          const getRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
            headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
          });
          if (getRes.ok) {
            const room = await getRes.json();
            roomUrl = room.url;
          } else {
            const freshName = `${roomName.slice(0, 30)}-${Date.now().toString(36).slice(-6)}`.toLowerCase();
            const retryRes = await createRoom(freshName);
            if (!retryRes.ok) {
              const rt = await retryRes.text();
              throw new Error(`Daily retry create failed: ${retryRes.status} ${rt}`);
            }
            const room = await retryRes.json();
            roomUrl = room.url;
          }
        }
      } else {
        throw new Error(`Daily create failed: ${createRes.status} ${errText}`);
      }
    }

    if (!roomUrl) throw new Error("No room URL returned");

    // Derive room name from URL (handles retry-with-fresh-suffix case)
    const actualRoomName = roomUrl.split("/").pop() || roomName;

    // Create meeting token for this user
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: actualRoomName,
          user_name: user_name || "Guest",
          user_id: userId,
          exp,
        },
      }),
    });
    if (!tokenRes.ok) {
      const te = await tokenRes.text();
      throw new Error(`Daily token failed: ${tokenRes.status} ${te}`);
    }
    const { token: meetingToken } = await tokenRes.json();

    // Persist on project + log call start
    await admin
      .from("projects")
      .update({
        video_room_url: roomUrl,
        video_room_started_at: new Date().toISOString(),
        video_room_started_by: userId,
      })
      .eq("id", project_id);

    const { data: callRow } = await admin
      .from("project_video_calls")
      .insert({
        project_id,
        started_by: userId,
        room_url: roomUrl,
        participants: [{ user_id: userId, name: user_name || "Guest" }],
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({ room_url: roomUrl, token: meetingToken, call_id: callRow?.id ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("[create-video-room]", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
