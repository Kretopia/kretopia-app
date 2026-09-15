// Daily cloud recording retention window.
//
// Audit finding: Daily cloud recording is created and referenced all over
// this codebase (create-sound-stage, create-video-room, create-meeting,
// create-circle-room, go-live-stage, create-event-room all request
// `enable_recording: "cloud"`; daily-recording-webhook and
// sync-daily-recordings both persist the resulting recording_id into
// call_transcripts) but nothing ever deleted an old one — recordings
// accumulate in Daily's cloud storage forever, with unbounded storage cost.
//
// RECORDING_RETENTION_DAYS below is a PLACEHOLDER POLICY VALUE, not a
// business decision made here. 90 days is a common, conservative default
// for "keep recent recordings, don't keep them forever" -- it is NOT derived
// from any product/legal requirement in this codebase (there wasn't one to
// find). Product/legal should confirm the real number before this is relied
// on for compliance purposes (e.g. if any jurisdiction Kretopia operates in
// has a mandated minimum/maximum retention for recorded calls).
//
// This constant is consumed by supabase/functions/purge-expired-recordings,
// which deletes the underlying Daily recording (not the call_transcripts
// row, and not its transcript/summary text) once it is older than this
// window. See that function's header comment for why merging it does not,
// by itself, start deleting anything in production.
export const RECORDING_RETENTION_DAYS = 90; // NEEDS PRODUCT/LEGAL DECISION — placeholder

export function recordingRetentionCutoffIso(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
