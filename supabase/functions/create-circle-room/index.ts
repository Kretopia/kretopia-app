import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { roomSessionExpiry } from "../_shared/roomSessionLimits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_API = "https://api.daily.co/v1";

/**
 * Creates (or reuses) a Daily room for a Circle group call. Members of the
 * Circle can call this to get a room URL + meeting token. Mirrors
 * create-video-room (project rooms) but gates on Circle membership.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { circle_id, user_name } = await req.json();
    if (!circle_id || typeof circle_id !== "string") {
      return new Response(JSON.stringify({ error: "circle_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: membership } = await admin
      .from("spark_room_members")
      .select("user_id")
      .eq("room_id", circle_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this Circle" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roomName = `cir-${circle_id.replace(/-/g, "").slice(0, 30)}`.toLowerCase();
    const exp = roomSessionExpiry(); // shared ceiling — see _shared/roomSessionLimits.ts

    const properties = {
      exp,
      max_participants: 20,
      enable_chat: true,
      enable_screenshare: true,
      enable_knocking: false,
      enable_prejoin_ui: false,
      enable_recording: "cloud",
    };

    let roomUrl: string | null = null;
    const createRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: roomName, privacy: "private", properties }),
    });
    if (createRes.ok) {
      const room = await createRes.json();
      roomUrl = room.url;
    } else if (createRes.status === 409 || createRes.status === 400) {
      // Room may already exist — patch properties + fetch URL
      await fetch(`${DAILY_API}/rooms/${roomName}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ properties }),
      });
      const getRes = await fetch(`${DAILY_API}/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
      });
      if (getRes.ok) {
        const room = await getRes.json();
        roomUrl = room.url;
      } else {
        const e = await getRes.text();
        throw new Error(`Daily fetch failed: ${getRes.status} ${e}`);
      }
    } else {
      const e = await createRes.text();
      throw new Error(`Daily create failed: ${createRes.status} ${e}`);
    }

    if (!roomUrl) throw new Error("No room URL");

    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { room_name: roomName, user_name: user_name || "Member", user_id: userId, exp },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token: meetingToken } = await tokenRes.json();

    // Log the call so members get history + a callable record
    const { data: callRow } = await admin
      .from("circle_video_calls")
      .insert({
        circle_id,
        started_by: userId,
        room_url: roomUrl,
        room_name: roomName,
        participants: [{ user_id: userId, name: user_name || "Member" }],
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        room_url: roomUrl,
        room_name: roomName,
        token: meetingToken,
        call_id: callRow?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("[create-circle-room]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
