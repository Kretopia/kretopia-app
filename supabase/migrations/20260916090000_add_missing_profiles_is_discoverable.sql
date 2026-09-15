-- Fixes a live "We couldn't load your identity details" error on /credits
-- (CreditsDashboard.tsx). Root cause: profiles.is_discoverable is
-- referenced by two frontend files (CreditsDashboard.tsx's own select
-- list, CreditsIdentityPanel.tsx's `profile?.is_discoverable !== false`
-- visibility check) but was never actually created by any migration --
-- confirmed via a full grep of supabase/migrations/ (zero hits) and of
-- the generated src/integrations/supabase/types.ts (also absent, which
-- reflects the real live schema, not just git). A wildcard-adjacent,
-- multi-column .select() fails its ENTIRE query the moment even one
-- named column doesn't exist (Postgres 42703) -- the exact mechanism
-- already diagnosed and fixed for `projects` this session, just a
-- genuinely-missing column here rather than a missing grant.
--
-- DEFAULT true matches the frontend's own existing assumption exactly
-- (`!== false` treats anything but an explicit false, including NULL, as
-- visible) -- every existing row keeps behaving exactly as it already
-- silently was (no code path anywhere writes this column today, so it
-- was always "visible" in effect; this just makes that real instead of
-- accidental). No UI currently lets a user set it false -- that's a
-- separate, not-yet-built feature, not something this migration invents.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT true;

-- public.profiles is in column-level SELECT-grant mode as of
-- 20260803091710 -- a newly added column carries no grant until named
-- explicitly. Not privileged (a visibility preference, not identity/
-- money/verification data), so it goes in the same anon+authenticated
-- bucket every other ordinary profile field already got that migration.
GRANT SELECT (is_discoverable) ON public.profiles TO authenticated, anon;
