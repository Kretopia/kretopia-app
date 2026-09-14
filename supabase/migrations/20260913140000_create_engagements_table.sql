-- "Bible" item: canonical Engagement object. The bible's full spec (tenant_id,
-- scope_version, unified lifecycle event contracts across hires/bookings/
-- services) is a multi-quarter rewrite and out of scope here -- this does not
-- authorize touching projects/opportunities/applications/matches, which work
-- today and stay as-is. What this DOES fix is a real, narrower gap found
-- while auditing that spec against the schema: a `projects` row carries no
-- structural link back to whatever produced it. `applications.studio_project_id`
-- (20260823224906) gives a reverse path for the opportunity-hire flow only --
-- match-based and direct creation have no link at all, and nothing on
-- `projects` itself says which path was used.
--
-- `engagements` is a thin, additive, one-row-per-project record of *how a
-- project came to exist* -- not a replacement for any existing table. org_id
-- reuses the org/workspace layer added in 20260912130000 (nullable, inert
-- until that layer grows an actual access model).

CREATE TABLE IF NOT EXISTS public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('opportunity_hire', 'match', 'direct')),
  source_opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  source_application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  source_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A row's source columns must match its declared mode -- catches a caller
  -- passing e.g. mode='direct' with a source_match_id still set, rather than
  -- silently trusting whichever value happened to be provided.
  CONSTRAINT engagements_mode_source_consistency CHECK (
    (mode = 'opportunity_hire' AND source_opportunity_id IS NOT NULL AND source_application_id IS NOT NULL AND source_match_id IS NULL)
    OR (mode = 'match' AND source_match_id IS NOT NULL AND source_opportunity_id IS NULL AND source_application_id IS NULL)
    OR (mode = 'direct' AND source_opportunity_id IS NULL AND source_application_id IS NULL AND source_match_id IS NULL)
  )
);

ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_engagements_source_opportunity ON public.engagements(source_opportunity_id) WHERE source_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engagements_source_match ON public.engagements(source_match_id) WHERE source_match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engagements_org_id ON public.engagements(org_id) WHERE org_id IS NOT NULL;

-- Same visibility as the project itself -- reuses the existing
-- is_project_member() helper (20260508135047) already shared by every other
-- project-scoped child table, so this doesn't introduce a second access model.
CREATE POLICY "members can view engagements"
ON public.engagements FOR SELECT
TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- Insert is only ever a same-transaction follow-up to creating the project
-- itself (client-side direct/match paths) or done SECURITY DEFINER inside
-- accept_application_and_create_studio() (which bypasses RLS entirely) --
-- so this only needs to cover the former.
CREATE POLICY "members can insert engagements for their project"
ON public.engagements FOR INSERT
TO authenticated
WITH CHECK (public.is_project_member(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "members can update engagement status"
ON public.engagements FOR UPDATE
TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER trg_engagements_updated BEFORE UPDATE ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: give every existing project an engagement row instead of leaving
-- history NULL. Best-effort classification from what's already on the row:
--   1. Was it accepted through the opportunity flow? (reverse lookup via
--      applications.studio_project_id, which is unique per application but
--      not enforced unique on the projects side -- DISTINCT ON picks one
--      deterministically if duplicates ever existed)
--   2. Else, does it carry a match_id?
--   3. Else, direct creation.
INSERT INTO public.engagements (project_id, org_id, mode, source_opportunity_id, source_application_id, source_match_id, created_by, created_at)
SELECT
  p.id,
  p.org_id,
  CASE
    WHEN app.id IS NOT NULL THEN 'opportunity_hire'
    WHEN p.match_id IS NOT NULL THEN 'match'
    ELSE 'direct'
  END,
  app.opportunity_id,
  app.id,
  CASE WHEN app.id IS NULL THEN p.match_id ELSE NULL END,
  p.created_by,
  p.created_at
FROM public.projects p
LEFT JOIN LATERAL (
  SELECT a.id, a.opportunity_id
  FROM public.applications a
  WHERE a.studio_project_id = p.id
  ORDER BY a.created_at ASC
  LIMIT 1
) app ON true
ON CONFLICT (project_id) DO NOTHING;

-- 2. Wire the canonical opportunity-acceptance RPC to create the engagement
--    row atomically alongside the project, instead of relying on a later
--    backfill to reconstruct it.
CREATE OR REPLACE FUNCTION public.accept_application_and_create_studio(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app       public.applications%ROWTYPE;
  _opp       public.opportunities%ROWTYPE;
  _caller    uuid := auth.uid();
  _project   uuid;
  _created   boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _app FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  SELECT * INTO _opp FROM public.opportunities WHERE id = _app.opportunity_id;
  IF NOT FOUND OR _opp.created_by IS DISTINCT FROM _caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Idempotent: reuse the Studio already created for this application
  IF _app.studio_project_id IS NOT NULL THEN
    _project := _app.studio_project_id;
  ELSE
    INSERT INTO public.projects (title, description, created_by, status)
    VALUES (_opp.title,
            'Project created from opportunity: ' || _opp.title,
            _caller,
            'active')
    RETURNING id INTO _project;
    _created := true;

    UPDATE public.applications
       SET studio_project_id = _project,
           status = 'accepted',
           updated_at = now()
     WHERE id = _application_id;

    INSERT INTO public.engagements (project_id, mode, source_opportunity_id, source_application_id, created_by)
    VALUES (_project, 'opportunity_hire', _opp.id, _application_id, _caller)
    ON CONFLICT (project_id) DO NOTHING;
  END IF;

  UPDATE public.applications
     SET status = 'accepted', updated_at = now()
   WHERE id = _application_id AND status IS DISTINCT FROM 'accepted';

  -- Applicant gains authorized Studio access (idempotent)
  INSERT INTO public.project_collaborators (project_id, user_id, invited_by, role, status, accepted_at)
  SELECT _project, _app.applicant_id, _caller, 'member', 'accepted', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_collaborators
     WHERE project_id = _project AND user_id = _app.applicant_id
  );

  UPDATE public.project_collaborators
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
   WHERE project_id = _project AND user_id = _app.applicant_id AND status <> 'accepted';

  -- Exactly one notification, after the Studio exists
  INSERT INTO public.notifications
    (user_id, type, title, message, action_url, action_text, category, priority, dedupe_key)
  VALUES
    (_app.applicant_id,
     'opportunity',
     'You''re hired',
     'You got the gig: ' || _opp.title,
     '/desk/' || _project::text,
     'Open Studio',
     'opportunity',
     'high',
     'studio-created:' || _project::text || ':applicant:' || _app.applicant_id::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', _project,
    'studio_created', _created,
    'applicant_id', _app.applicant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_application_and_create_studio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_application_and_create_studio(uuid) TO authenticated;
