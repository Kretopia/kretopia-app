// Mint a Daily meeting token for an authenticated user joining a meeting,
// or for a guest holding the meeting's share_token (public path).
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { meeting_id, share_token, user_name } = await req.json();
    if (!meeting_id) return json({ error: "meeting_id required" }, 400);

    const { data: meeting, error: mErr } = await admin
      .from("meetings")
      .select("*")
      .eq("id", meeting_id)
      .maybeSingle();
    if (mErr || !meeting) return json({ error: "Meeting not found" }, 404);

    // Try auth path first
    const authHeader = req.headers.get("Authorization") ?? "";
    let userId: string | null = null;
    let isHost = false;
    let isGuest = false;
    let participantRole: string = "guest";

    if (authHeader.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claims } = await supabase.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      userId = (claims?.claims?.sub as string | undefined) ?? null;
    }

    if (userId) {
      isHost = meeting.host_id === userId;
      if (!isHost) {
        const { data: pRow } = await admin
          .from("meeting_participants")
          .select("role")
          .eq("meeting_id", meeting_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (pRow) {
          participantRole = pRow.role;
        } else if (share_token && share_token === meeting.share_token) {
          // Logged-in user opening a legitimate shared link — same trust
          // level as the anonymous guest path below, just authenticated.
          await admin.from("meeting_participants").insert({
            meeting_id,
            user_id: userId,
            role: "attendee",
            status: "invited",
          });
          participantRole = "attendee";
        } else {
          // No prior invite and no valid share_token: being logged in to
          // *some* Kretopia account is not, by itself, authorization to
          // join *this* meeting. Previously this branch auto-enrolled any
          // authenticated caller as an attendee — see
          // docs/SECURITY_FINDINGS.md for the finding this closes.
          return json({ error: "You are not invited to this meeting" }, 403);
        }
      } else {
        participantRole = "host";
      }
    } else {
      // Guest path
      if (!share_token || share_token !== meeting.share_token) {
        return json({ error: "Invalid share token" }, 403);
      }
      isGuest = true;
      participantRole = "guest";
    }

    const exp = roomSessionExpiry(); // shared ceiling — see _shared/roomSessionLimits.ts
    const tokenRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: meeting.room_name,
          user_name: user_name || (isGuest ? "Guest" : "Member"),
          user_id: userId ?? undefined,
          is_owner: isHost,
          exp,
        },
      }),
    });
    if (!tokenRes.ok) throw new Error(`Daily token failed: ${tokenRes.status}`);
    const { token } = await tokenRes.json();

    // Mark joined for known participants
    if (userId) {
      await admin
        .from("meeting_participants")
        .update({ status: "joined", joined_at: new Date().toISOString() })
        .eq("meeting_id", meeting_id)
        .eq("user_id", userId);
    }

    return json({
      token,
      room_url: meeting.room_url,
      room_name: meeting.room_name,
      role: participantRole,
      title: meeting.title,
      recording_enabled: meeting.recording_enabled,
    });
  } catch (e) {
    console.error("[mint-meeting-token]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
