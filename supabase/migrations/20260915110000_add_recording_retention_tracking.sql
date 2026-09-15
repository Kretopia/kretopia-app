-- Recording retention mechanism (P2 reliability audit finding: Daily cloud
-- recording is created and referenced everywhere, but nothing ever deletes
-- or expires an old recording -- they persist in Daily's cloud storage
-- indefinitely, accumulating storage cost forever).
--
-- This migration only adds the bookkeeping column the cleanup edge function
-- (supabase/functions/purge-expired-recordings) needs to track which
-- call_transcripts rows have already had their underlying Daily recording
-- deleted, so a re-run doesn't re-attempt (and doesn't need to distinguish
-- "never had a recording" from "recording was purged"). It does not delete
-- any data itself and does not schedule anything to run -- see that
-- function's header comment, and _shared/recordingRetention.ts for the
-- (placeholder) retention window.
ALTER TABLE public.call_transcripts
  ADD COLUMN IF NOT EXISTS recording_deleted_at timestamptz;

COMMENT ON COLUMN public.call_transcripts.recording_deleted_at IS
  'Set by purge-expired-recordings when the underlying Daily cloud recording '
  'has been deleted past the retention window in _shared/recordingRetention.ts. '
  'transcript/summary text is intentionally left in place -- only the '
  'recording media + recording_url are purged. NULL means either the '
  'recording is still within its retention window or this row never had a '
  'recording_id in the first place.';

CREATE INDEX IF NOT EXISTS idx_call_transcripts_pending_purge
  ON public.call_transcripts (created_at)
  WHERE recording_id IS NOT NULL AND recording_deleted_at IS NULL;
