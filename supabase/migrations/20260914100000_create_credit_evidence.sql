-- "Bible" item: universal Evidence object for credits/reputation. Confirmed
-- absent entirely -- no evidence table anywhere, and what exists is four
-- disconnected signals (credit_ai_verifications, credit_endorsements,
-- credit_vouches, credit_claim_disputes) with no unifying read model, plus
-- two states the bible calls for that don't exist in any form: a project's
-- actual CLIENT confirming someone's role (as opposed to a peer collaborator
-- vouching), and a credit being backed by a real, completed PAYMENT.
--
-- This does not touch or replace credit_ai_verifications/credit_endorsements/
-- credit_vouches/credit_claim_disputes -- all four keep writing exactly as
-- they do today. credit_evidence is an additive, append-only ledger that
-- mirrors every meaningful event from those four via triggers (zero
-- application code touched for them), backfills history once, and adds the
-- two genuinely new evidence kinds as their own first-class write paths.

-- ---------------------------------------------------------------------------
-- 0. Confirmed live bug, found while wiring this up: desk-agent's add_credit
--    tool (supabase/functions/desk-agent/index.ts) has always written
--    verification_status = 'self_reported', but credits_verification_status_check
--    (last touched 20260819140000) never allowed that value -- same
--    constraint-drift bug class already found and fixed three times in this
--    schema (20260807120000, 20260819140000, 20260910120200). Every "log this
--    as a credit" request through Desk has been silently rolling back.
--    'self_reported' is also exactly the bible's "Claimed" rung -- the
--    starting state this whole Evidence ladder builds on top of.
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN (
    'unverified', 'verified', 'pending', 'pending_review', 'rejected',
    'auto_discovered', 'disputed', 'peer', 'self_reported'
  ));

-- ---------------------------------------------------------------------------
-- 1. credits.project_id -- nullable, additive, same precedent as org_id on
--    projects/profiles (20260912130000) and engagements (20260913140000).
--    credits today are almost entirely self-reported free text
--    (project_name is TEXT, not a FK) -- this doesn't change that. It only
--    gives the ONE call site that already has a real project in hand
--    (desk-agent's add_credit, see below) a place to record it, which is
--    what unlocks transaction_link evidence: proof a credit corresponds to
--    an actual paid Kretopia project, not just a claim.
--
--    A new column is unwritable by `authenticated` by default (20260904210000's
--    exclusion-list re-GRANT for this exact table only covers columns that
--    existed when it ran) -- and that's the right default here, same
--    reasoning as org_id: if a raw client PATCH could set project_id, any
--    user could fabricate transaction_link/client_confirmation eligibility
--    for their own credits by pointing at a project they have no real
--    relationship to. Only desk-agent (service role, below) sets it today;
--    a future user-facing "link this credit to a project" flow should go
--    through a SECURITY DEFINER RPC that verifies real project membership,
--    not a raw update.
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_credits_project_id ON public.credits(project_id) WHERE project_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. The ledger itself.
CREATE TABLE IF NOT EXISTS public.credit_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'ai_verification', 'endorsement', 'vouch', 'dispute',
    'client_confirmation', 'transaction_link'
  )),
  -- What THIS evidence record's own assertion resolved to -- e.g. for
  -- 'dispute', 'confirmed' means the challenge was upheld (the claim is
  -- wrong), not that the credit itself is good; read alongside `kind`.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'revoked')),
  actor_user_id UUID,
  actor_role TEXT,
  summary TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Traceability back to whichever table produced this row, when mirrored
  -- rather than native. No uniqueness enforced on these -- a single source
  -- row can legitimately produce more than one ledger event over its
  -- lifetime (e.g. a dispute filed, then later resolved).
  source_table TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_evidence_credit ON public.credit_evidence(credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_evidence_kind ON public.credit_evidence(kind);
CREATE INDEX IF NOT EXISTS idx_credit_evidence_source ON public.credit_evidence(source_table, source_id) WHERE source_table IS NOT NULL;

-- One client confirmation per credit -- a second call is a no-op (see RPC).
CREATE UNIQUE INDEX IF NOT EXISTS credit_evidence_one_client_confirmation
  ON public.credit_evidence(credit_id) WHERE kind = 'client_confirmation';

ALTER TABLE public.credit_evidence ENABLE ROW LEVEL SECURITY;

-- Same visibility as credits itself ("Anyone can read credits", 20260326175249
-- -- scoped TO authenticated, not anon, matched exactly here).
CREATE POLICY "Anyone can read credit evidence"
ON public.credit_evidence FOR SELECT
TO authenticated
USING (true);

-- Deliberately no INSERT/UPDATE/DELETE policy for authenticated/anon: with
-- RLS enabled, no policy means no direct client write regardless of
-- table-level grants. Every row is written by a SECURITY DEFINER trigger
-- (mirroring the four existing tables, or milestones for transaction_link)
-- or a SECURITY DEFINER RPC (confirm_credit_as_client) -- never a raw PATCH.

-- ---------------------------------------------------------------------------
-- 3. Mirror triggers for the four existing signals. Each trigger function is
--    SECURITY DEFINER so it can write credit_evidence despite that table
--    having no client-facing INSERT policy; none of them change the
--    behavior, columns, or RLS of the table they're attached to.

CREATE OR REPLACE FUNCTION public.mirror_ai_verification_to_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.credit_evidence (credit_id, kind, status, summary, detail, source_table, source_id)
  VALUES (
    NEW.credit_id,
    'ai_verification',
    CASE NEW.status
      WHEN 'verified' THEN 'confirmed'
      WHEN 'unverifiable' THEN 'rejected'
      WHEN 'suspicious' THEN 'rejected'
      ELSE 'pending'
    END,
    NEW.ai_summary,
    jsonb_build_object('confidence_score', NEW.confidence_score, 'evidence_links', NEW.evidence_links),
    'credit_ai_verifications',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_ai_verification_evidence ON public.credit_ai_verifications;
CREATE TRIGGER trg_mirror_ai_verification_evidence
  AFTER INSERT OR UPDATE OF status ON public.credit_ai_verifications
  FOR EACH ROW EXECUTE FUNCTION public.mirror_ai_verification_to_evidence();

CREATE OR REPLACE FUNCTION public.mirror_endorsement_to_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only a resolved endorsement is evidence -- a pending request or one that
  -- simply expired unanswered asserts nothing about the credit.
  IF NEW.status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id)
  VALUES (
    NEW.credit_id,
    'endorsement',
    CASE NEW.status WHEN 'accepted' THEN 'confirmed' ELSE 'rejected' END,
    NEW.endorser_id,
    'collaborator',
    NEW.testimonial,
    jsonb_build_object('relationship', NEW.relationship),
    'credit_endorsements',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_endorsement_evidence ON public.credit_endorsements;
CREATE TRIGGER trg_mirror_endorsement_evidence
  AFTER INSERT OR UPDATE OF status ON public.credit_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.mirror_endorsement_to_evidence();

CREATE OR REPLACE FUNCTION public.mirror_vouch_to_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id)
  VALUES (
    NEW.credit_id,
    'vouch',
    CASE NEW.action WHEN 'vouched' THEN 'confirmed' ELSE 'rejected' END,
    NEW.voucher_id,
    'collaborator',
    NEW.note,
    '{}'::jsonb,
    'credit_vouches',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_vouch_evidence ON public.credit_vouches;
CREATE TRIGGER trg_mirror_vouch_evidence
  AFTER INSERT ON public.credit_vouches
  FOR EACH ROW EXECUTE FUNCTION public.mirror_vouch_to_evidence();

CREATE OR REPLACE FUNCTION public.mirror_dispute_to_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id)
    VALUES (
      NEW.credit_id, 'dispute', 'pending', NEW.challenger_id, 'challenger',
      NEW.challenger_evidence,
      jsonb_build_object('challenger_role', NEW.challenger_role, 'source_url', NEW.source_url),
      'credit_claim_disputes', NEW.id
    );
    RETURN NEW;
  END IF;

  -- Resolution: fires once when status leaves 'pending'.
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pending' THEN
    INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id)
    VALUES (
      NEW.credit_id, 'dispute',
      CASE
        WHEN NEW.status IN ('approved', 'resolved_for_challenger', 'transferred') THEN 'confirmed'
        ELSE 'rejected'
      END,
      NEW.resolved_by, 'admin_or_owner',
      NEW.resolution_note,
      jsonb_build_object('resolved_status', NEW.status),
      'credit_claim_disputes', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_dispute_evidence ON public.credit_claim_disputes;
CREATE TRIGGER trg_mirror_dispute_evidence
  AFTER INSERT OR UPDATE OF status ON public.credit_claim_disputes
  FOR EACH ROW EXECUTE FUNCTION public.mirror_dispute_to_evidence();

-- ---------------------------------------------------------------------------
-- 4. Genuinely new evidence kind #1: Client Confirmed. Gated to whoever is
--    actually authorized to speak for the project's client side -- the same
--    authorized-payer set create-milestone-payment already uses
--    (client_user_id or created_by) -- not any authenticated user, and not
--    a peer collaborator (that's what credit_vouches already covers).
CREATE OR REPLACE FUNCTION public.confirm_credit_as_client(_credit_id UUID, _note TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credit  public.credits%ROWTYPE;
  _project public.projects%ROWTYPE;
  _caller  UUID := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _credit FROM public.credits WHERE id = _credit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'credit_not_found');
  END IF;
  IF _credit.project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'credit_not_linked_to_a_project');
  END IF;

  SELECT * INTO _project FROM public.projects WHERE id = _credit.project_id;
  -- IS DISTINCT FROM, not NOT IN: client_user_id is frequently NULL (it's a
  -- separate nullable column from created_by), and `x NOT IN (a, NULL)`
  -- evaluates to NULL rather than a boolean whenever x <> a -- which
  -- plpgsql's IF treats as "don't enter this branch", silently waving
  -- through any authenticated caller who isn't created_by either. Same bug
  -- class as the credit_claim_disputes WITH CHECK fix (20260817140000).
  IF NOT FOUND
     OR (_caller IS DISTINCT FROM _project.client_user_id AND _caller IS DISTINCT FROM _project.created_by)
  THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary)
  VALUES (_credit_id, 'client_confirmation', 'confirmed', _caller, 'client', _note)
  ON CONFLICT (credit_id) WHERE kind = 'client_confirmation' DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_credit_as_client(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_credit_as_client(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Genuinely new evidence kind #2: Transaction-supported. The strongest,
--    hardest-to-fake evidence there is -- a real completed payment. Fires
--    automatically; no UI required. Only reachable now that credits can
--    carry a project_id (see #1) -- historically this could never have
--    matched anything.
CREATE OR REPLACE FUNCTION public.link_paid_milestone_to_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' OR OLD.status IS NOT DISTINCT FROM 'paid' OR NEW.paid_to IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, detail, source_table, source_id)
  SELECT c.id, 'transaction_link', 'confirmed', NEW.paid_to, 'system',
         jsonb_build_object('milestone_id', NEW.id, 'amount', NEW.amount, 'paid_at', NEW.paid_at),
         'milestones', NEW.id
  FROM public.credits c
  WHERE c.project_id = NEW.project_id AND c.user_id = NEW.paid_to;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_paid_milestone_evidence ON public.milestones;
CREATE TRIGGER trg_link_paid_milestone_evidence
  AFTER UPDATE OF status ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.link_paid_milestone_to_evidence();

-- ---------------------------------------------------------------------------
-- 6. One-time backfill of history from the four existing tables. Safe to
--    run once: this migration runs exactly once, and nothing above changes
--    what future INSERT/UPDATE statements on these tables produce (the
--    triggers just added will handle everything from here on).
INSERT INTO public.credit_evidence (credit_id, kind, status, summary, detail, source_table, source_id, created_at)
SELECT credit_id, 'ai_verification',
       CASE status WHEN 'verified' THEN 'confirmed' WHEN 'unverifiable' THEN 'rejected' WHEN 'suspicious' THEN 'rejected' ELSE 'pending' END,
       ai_summary, jsonb_build_object('confidence_score', confidence_score, 'evidence_links', evidence_links),
       'credit_ai_verifications', id, verified_at
FROM public.credit_ai_verifications;

INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id, created_at)
SELECT credit_id, 'endorsement', CASE status WHEN 'accepted' THEN 'confirmed' ELSE 'rejected' END,
       endorser_id, 'collaborator', testimonial, jsonb_build_object('relationship', relationship),
       'credit_endorsements', id, COALESCE(responded_at, requested_at)
FROM public.credit_endorsements
WHERE status IN ('accepted', 'declined');

INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, source_table, source_id, created_at)
SELECT credit_id, 'vouch', CASE action WHEN 'vouched' THEN 'confirmed' ELSE 'rejected' END,
       voucher_id, 'collaborator', note, 'credit_vouches', id, created_at
FROM public.credit_vouches;

INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id, created_at)
SELECT credit_id, 'dispute', 'pending', challenger_id, 'challenger', challenger_evidence,
       jsonb_build_object('challenger_role', challenger_role, 'source_url', source_url),
       'credit_claim_disputes', id, created_at
FROM public.credit_claim_disputes;

INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, summary, detail, source_table, source_id, created_at)
SELECT credit_id,
       'dispute',
       CASE WHEN status IN ('approved', 'resolved_for_challenger', 'transferred') THEN 'confirmed' ELSE 'rejected' END,
       resolved_by, 'admin_or_owner', resolution_note, jsonb_build_object('resolved_status', status),
       'credit_claim_disputes', id, COALESCE(resolved_at, updated_at)
FROM public.credit_claim_disputes
WHERE status <> 'pending';

-- Historical transaction_link backfill: any already-paid milestone whose
-- project now (or already did) have a linked credit for the same payee.
INSERT INTO public.credit_evidence (credit_id, kind, status, actor_user_id, actor_role, detail, source_table, source_id, created_at)
SELECT c.id, 'transaction_link', 'confirmed', m.paid_to, 'system',
       jsonb_build_object('milestone_id', m.id, 'amount', m.amount, 'paid_at', m.paid_at),
       'milestones', m.id, COALESCE(m.paid_at, m.updated_at)
FROM public.milestones m
JOIN public.credits c ON c.project_id = m.project_id AND c.user_id = m.paid_to
WHERE m.status = 'paid' AND m.paid_to IS NOT NULL;
