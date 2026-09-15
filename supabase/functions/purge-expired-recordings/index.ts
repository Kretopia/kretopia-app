// Recording retention cleanup — P2 reliability audit finding.
//
// Daily cloud recording is created all over this codebase (create-sound-
// stage, create-video-room, create-meeting, create-circle-room,
// go-live-stage, create-event-room) and referenced via call_transcripts
// (recording_id / recording_url), but until this function existed nothing
// ever deleted an old one. Recordings just accumulated in Daily's cloud
// storage indefinitely.
//
// This function deletes the underlying Daily recording (via Daily's
// DELETE /recordings/{id}) for any call_transcripts row whose recording is
// older than RECORDING_RETENTION_DAYS (see _shared/recordingRetention.ts —
// a placeholder value pending a real product/legal decision) and hasn't
// already been purged. It intentionally leaves the call_transcripts row,
// and its transcript/summary text, in place — only the recording media
// itself and its (already short-lived) recording_url are removed. Marks
// recording_deleted_at so a re-run doesn't retry it.
//
// IMPORTANT — this performs REAL deletions when invoked. Per this repo's
// established convention (see the header comment in
// supabase/migrations/20260914090000_reconcile_stale_orch_runs.sql, and
// 'process-email-queue' referenced there), pg_cron scheduling is applied
// out-of-band via the SQL editor, NOT via a migration. Merging this
// function does NOT start deleting anything in production by itself — an
// operator must explicitly run, e.g.:
//   SELECT cron.schedule('purge-expired-recordings', '0 4 * * *',
//     $$SELECT net.http_post(
//         url := '<project-url>/functions/v1/purge-expired-recordings',
//         headers := jsonb_build_object(
//           'Authorization', 'Bearer <service_role_key>',
//           'x-cron-secret', '<CRON_SECRET>',
//           'Content-Type', 'application/json'
//         ),
//         body := '{}'::jsonb
//       );$$);
// Until that's applied, this is callable on-demand (by an admin, or with the
// CRON_SECRET header) but nothing calls it automatically.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { RECORDING_RETENTION_DAYS, recordingRetentionCutoffIso } from "../_shared/recordingRetention.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DAILY_API = "https://api.daily.co/v1";

interface Body {
  /** Preview what would be purged without calling Daily or writing anything. */
  dry_run?: boolean;
  /** Cap rows examined per run (default 50, matches sync-daily-recordings' style). */
  limit?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  try {
    const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
    if (!DAILY_API_KEY) throw new Error("DAILY_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json().catch(() => ({}))) as Body;
    const dryRun = body.dry_run === true;
    const limit = Math.min(Math.max(Number(body.limit ?? 50), 1), 200);
    const cutoffIso = recordingRetentionCutoffIso();

    const { data: candidates, error: qErr } = await admin
      .from("call_transcripts")
      .select("id, recording_id, call_kind, created_at")
      .not("recording_id", "is", null)
      .is("recording_deleted_at", null)
      .lt("created_at", cutoffIso)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (qErr) throw qErr;

    if (!candidates?.length) {
      return json({
        ok: true,
        retention_days: RECORDING_RETENTION_DAYS,
        cutoff: cutoffIso,
        checked: 0,
        purged: 0,
        dry_run: dryRun,
      });
    }

    if (dryRun) {
      return json({
        ok: true,
        retention_days: RECORDING_RETENTION_DAYS,
        cutoff: cutoffIso,
        checked: candidates.length,
        would_purge: candidates.map((c) => ({ id: c.id, recording_id: c.recording_id, created_at: c.created_at })),
        dry_run: true,
      });
    }

    let purged = 0;
    const results: Array<{ id: string; recording_id: string; ok: boolean; error?: string }> = [];

    for (const row of candidates) {
      const recordingId = row.recording_id as string;
      try {
        const delRes = await fetch(`${DAILY_API}/recordings/${recordingId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
        });
        // 200 = deleted, 404 = already gone (e.g. manually removed in Daily's
        // dashboard) — both mean "no longer needs purging" from our side.
        if (!delRes.ok && delRes.status !== 404) {
          const t = await delRes.text().catch(() => "");
          throw new Error(`Daily delete failed: ${delRes.status} ${t}`);
        }

        const { error: updErr } = await admin
          .from("call_transcripts")
          .update({ recording_url: null, recording_deleted_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updErr) throw updErr;

        purged += 1;
        results.push({ id: row.id, recording_id: recordingId, ok: true });
      } catch (e) {
        console.error("[purge-expired-recordings] failed for", row.id, e);
        results.push({
          id: row.id,
          recording_id: recordingId,
          ok: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return json({
      ok: true,
      retention_days: RECORDING_RETENTION_DAYS,
      cutoff: cutoffIso,
      checked: candidates.length,
      purged,
      results,
      dry_run: false,
    });
  } catch (e) {
    console.error("[purge-expired-recordings]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
