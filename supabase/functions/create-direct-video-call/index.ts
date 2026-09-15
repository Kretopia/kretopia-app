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

    // invited_user_id is optional — when omitted we create a "quick call"
    // room the host joins solo and shares via guest link.
    const { invited_user_id, user_name } = await req.json();
    const invitedUserId =
      typeof invited_user_id === "string" && invited_user_id.length > 0
        ? invited_user_id
        : null;

    const roomName = `dm-${crypto.randomUUID().replace(/-/g, "").slice(0, 30)}`;
    // Was previously 2h here — unified on the shared ceiling. See
    // _shared/roomSessionLimits.ts for the full previously-inconsistent list.
    const exp = roomSessionExpiry();

    const createRes = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp,
          max_participants: 4,
          enable_chat: true,
          enable_screenshare: true,
          enable_knocking: true,
          enable_prejoin_ui: false,
          enable_recording: "cloud",
        },
      }),
    });
    if (!createRes.ok) {
      const e = await createRes.text();
      throw new Error(`Daily create failed: ${createRes.status} ${e}`);
    }
    const room = await createRes.json();

    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { room_name: roomName, user_name: user_name || "Guest", user_id: userId, exp },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token: meetingToken } = await tokenRes.json();

    const { data: callRow } = await admin
      .from("direct_video_calls")
      .insert({
        room_name: roomName,
        room_url: room.url,
        started_by: userId,
        invited_user_id: invitedUserId,
        participants: [{ user_id: userId, name: user_name || "Guest" }],
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        room_url: room.url,
        room_name: roomName,
        token: meetingToken,
        call_id: callRow?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("[create-direct-video-call]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
