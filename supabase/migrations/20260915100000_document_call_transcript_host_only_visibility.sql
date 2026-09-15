-- Documentation-only migration -- no behavior change.
--
-- Reliability audit (see PR description) flagged that call_transcripts
-- visibility for Sound Stage / Curated Stage / speed-session / meeting /
-- event calls was undocumented: it looked like it might be an oversight
-- that only the host can see the transcript for those call kinds, since
-- 'project' and 'direct' and 'circle' calls have richer, participant-aware
-- visibility (see the OR branches below) while the newer kinds do not.
--
-- Tracing it through: call_transcripts_call_kind_check was widened over two
-- migrations (20260512185847_..., 20260518143517_...) to add
-- 'meeting','event','sound_stage','speed_session','curated_stage', but
-- public.user_can_view_call_transcript's OR-branches were never extended to
-- match. The effect for those five newer call kinds is that ONLY
-- `created_by = _user` (the call's creator -- practically always the host
-- for a stage/meeting/event) can pass the RLS SELECT policy on
-- call_transcripts; no participant/attendee branch exists for them the way
-- it does for 'project', 'direct' and 'circle'.
--
-- Confirmed this is the actual, sole enforcement point: the client
-- (src/pages/Recordings.tsx, src/components/calls/CallRecapSheet.tsx) does
-- a plain `supabase.from("call_transcripts").select(...)` with no
-- client-side role/kind filtering at all -- whatever this function allows
-- through RLS is exactly what a viewer sees, host or not.
--
-- This migration changes nothing about that behavior. It re-issues the
-- identical function body with comments recording that host-only
-- visibility for stage/meeting/event transcripts is the CURRENT, DELIBERATE
-- rule being documented here (per this audit), not a bug -- so a future
-- reader doesn't "fix" it into matching the project/direct/circle
-- participant-aware behavior without a product decision to do so. Whether
-- attendees/speakers should also see a stage's transcript is a real product
-- question (e.g. should everyone who spoke on a Sound Stage get the
-- transcript, or just the host who might resell/repurpose it?) that is out
-- of scope here -- this migration only documents today's rule.
CREATE OR REPLACE FUNCTION public.user_can_view_call_transcript(_user uuid, _t public.call_transcripts)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Creator/host can always see their own transcript, regardless of kind.
    -- For call_kind IN ('meeting','event','sound_stage','speed_session',
    -- 'curated_stage') this branch is the ONLY way in -- see the migration
    -- header comment above. That is intentional: transcripts for stages,
    -- meetings and events are host-only today. Extend with a dedicated
    -- branch (mirroring the 'project'/'direct'/'circle' branches below) if
    -- product decides attendees/speakers should see them too.
    _t.created_by = _user
    OR (_t.call_kind = 'project' AND _t.project_id IS NOT NULL
        AND public.user_has_project_access(_t.project_id, _user))
    OR (_t.call_kind = 'direct' AND EXISTS (
        SELECT 1 FROM public.direct_video_calls d
        WHERE d.id = _t.call_id
          AND (_user = d.started_by OR _user = d.invited_user_id)
    ))
    OR (_t.call_kind = 'circle' AND EXISTS (
        SELECT 1 FROM public.circle_video_calls c
        WHERE c.id = _t.call_id AND c.started_by = _user
    ));
$$;

COMMENT ON FUNCTION public.user_can_view_call_transcript(uuid, public.call_transcripts) IS
  'RLS predicate for call_transcripts SELECT. Host/creator can always view. '
  'project/direct/circle calls additionally allow participants. '
  'meeting/event/sound_stage/speed_session/curated_stage transcripts are '
  'HOST-ONLY BY DESIGN (documented 2026-09-15 audit, not a bug) -- no '
  'participant branch exists for those kinds.';
