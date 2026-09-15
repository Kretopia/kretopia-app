-- Widen get_public_profiles_safe() / public_profiles_safe with the fields
-- CompCard.tsx and CreatorSite.tsx/CreatorSiteByUsername.tsx need to render
-- for anonymous visitors. Both pages currently query raw public.profiles,
-- which the RLS row-visibility policy blocks for anyone but the owner --
-- the same class of bug already fixed for src/pages/CreatorEPK.tsx by
-- switching it onto this view (see that file's comment for the fields still
-- missing from here). All added columns are owner-authored public content
-- (comp card layout, model info, personal site content/settings) already
-- selected client-side by these pages today; none of the genuinely private
-- fields on profiles (usage counters, billing internals, verification notes,
-- promo/streak state, etc.) are added.
--
-- Postgres won't let CREATE OR REPLACE FUNCTION change a RETURNS TABLE
-- column list, so the function (and the view depending on it) must be
-- dropped and recreated.
DROP VIEW IF EXISTS public.public_profiles_safe;
DROP FUNCTION IF EXISTS public.get_public_profiles_safe();

CREATE FUNCTION public.get_public_profiles_safe()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  role text,
  bio text,
  location text,
  professional_skills jsonb,
  badge public.user_badge,
  xp integer,
  level integer,
  onboarding_completed boolean,
  account_type public.account_type,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  twitter_url text,
  linkedin_url text,
  id_verified boolean,
  verification_status text,
  verification_tier text,
  membership_number text,
  cover_image_url text,
  behance_url text,
  imdb_url text,
  soundcloud_url text,
  spotify_url text,
  created_at timestamptz,
  updated_at timestamptz,
  -- CompCard.tsx
  mother_agency text,
  model_unions text[],
  model_categories text[],
  model_stats jsonb,
  comp_card_layout jsonb,
  sub_roles text[],
  -- CreatorSite.tsx / CreatorSiteByUsername.tsx
  website text,
  calendly_url text,
  rate_range text,
  site_template text,
  site_enabled boolean,
  site_headline text,
  site_bio text,
  site_sections jsonb,
  site_custom_blocks jsonb,
  subscription_tier text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.full_name, p.username, p.avatar_url, p.role, p.bio, p.location,
         p.professional_skills, p.badge, p.xp, p.level, p.onboarding_completed,
         p.account_type, p.instagram_url, p.tiktok_url, p.youtube_url, p.twitter_url,
         p.linkedin_url, p.id_verified, p.verification_status, p.verification_tier,
         p.membership_number, p.cover_image_url, p.behance_url, p.imdb_url,
         p.soundcloud_url, p.spotify_url, p.created_at, p.updated_at,
         p.mother_agency, p.model_unions, p.model_categories, p.model_stats,
         p.comp_card_layout, p.sub_roles,
         p.website, p.calendly_url, p.rate_range, p.site_template, p.site_enabled,
         p.site_headline, p.site_bio, p.site_sections, p.site_custom_blocks,
         p.subscription_tier
  FROM public.profiles p
  WHERE p.is_hidden_backer = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles_safe() TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.public_profiles_safe
WITH (security_invoker = true) AS
  SELECT * FROM public.get_public_profiles_safe();

GRANT SELECT ON public.public_profiles_safe TO anon, authenticated, service_role;
