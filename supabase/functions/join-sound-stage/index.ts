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
 * Joiner-side: mint a meeting token for an in-progress Sound Stage.
 * Anyone authenticated can join a live, public Open Stage.
 */
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
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
    const t = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(t);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { stage_id, user_name } = await req.json();
    if (!stage_id) throw new Error("stage_id required");

    const { data: stage } = await admin
      .from("sound_stages")
      .select(
        "id, host_user_id, room_name, room_url, is_live, format, participant_count, mode",
      )
      .eq("id", stage_id)
      .maybeSingle();
    if (!stage || !stage.is_live) {
      return new Response(JSON.stringify({ error: "Stage not live" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Was previously 2h here, independent of the 4h create-sound-stage used
    // for the same stage — now unified on the shared ceiling. See
    // _shared/roomSessionLimits.ts for the full previously-inconsistent list.
    const exp = roomSessionExpiry();
    const isHost = stage.host_user_id === userId;
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: stage.room_name,
          user_name: user_name || "Guest",
          user_id: userId,
          exp,
          start_video_off: stage.mode === "audio" || !isHost,
          start_audio_off: !isHost,
          is_owner: isHost,
        },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token: meetingToken } = await tokenRes.json();

    // Best-effort bump
    await admin
      .from("sound_stages")
      .update({ participant_count: (stage.participant_count ?? 0) + 1 })
      .eq("id", stage_id);

    return new Response(
      JSON.stringify({
        room_url: stage.room_url,
        room_name: stage.room_name,
        token: meetingToken,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    console.error("[join-sound-stage]", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
