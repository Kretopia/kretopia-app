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
 * Mints a Daily meeting token for an authenticated user joining an existing
 * room. Used by:
 *  - The receiver of a 1:1 ring (must be invited or the caller).
 *  - Project room members joining mid-call.
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
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { room_name, user_name } = await req.json();
    if (!room_name || typeof room_name !== "string") {
      return new Response(JSON.stringify({ error: "room_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller is participant in a project room or the
    // direct call this room belongs to.
    let allowed = false;

    if (room_name.startsWith("td-")) {
      // Project room: derive project_id by scanning projects.video_room_url ↦ name.
      const { data: prj } = await admin
        .from("projects")
        .select("id")
        .ilike("video_room_url", `%/${room_name}`)
        .maybeSingle();
      if (prj?.id) {
        const { data: hasAccess } = await admin.rpc("user_has_project_access", {
          project_id_param: prj.id,
          user_id_param: userId,
        });
        allowed = !!hasAccess;
      }
    } else if (room_name.startsWith("dm-")) {
      const { data: dm } = await admin
        .from("direct_video_calls")
        .select("started_by, invited_user_id")
        .eq("room_name", room_name)
        .maybeSingle();
      allowed = !!dm && (dm.started_by === userId || dm.invited_user_id === userId);
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Was previously 2h here — unified on the shared ceiling. See
    // _shared/roomSessionLimits.ts for the full previously-inconsistent list.
    const exp = roomSessionExpiry();
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { room_name, user_name: user_name || "Guest", user_id: userId, exp },
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`Daily token failed: ${tokenRes.status} ${t}`);
    }
    const { token: meetingToken } = await tokenRes.json();
    return new Response(JSON.stringify({ token: meetingToken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[mint-video-token]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
