import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SEO } from "@/components/SEO";
import { APP_URL } from "@/lib/constants";
import type { ContentBlock } from "@/components/creator-site/blocks/BlockTypes";
import { BoldElectricTemplate } from "@/components/creator-site/BoldElectricTemplate";
import { MinimalEditorialTemplate } from "@/components/creator-site/MinimalEditorialTemplate";
import { PortfolioMosaicTemplate } from "@/components/creator-site/PortfolioMosaicTemplate";
import { CreativeDirectorTemplate } from "@/components/creator-site/CreativeDirectorTemplate";
import { ArtistShowcaseTemplate } from "@/components/creator-site/ArtistShowcaseTemplate";
import { ProducerTemplate } from "@/components/creator-site/ProducerTemplate";
import { AgencyTemplate } from "@/components/creator-site/AgencyTemplate";
import { MinimalCleanTemplate } from "@/components/creator-site/MinimalCleanTemplate";
import { PhotographerTemplate } from "@/components/creator-site/PhotographerTemplate";
import { Loader2 } from "lucide-react";
import { useSiteViewTracker } from "@/hooks/useSiteAnalytics";

export interface CreatorSiteData {
  profile: {
    user_id: string;
    full_name: string;
    role: string;
    bio: string;
    location: string;
    avatar_url: string;
    cover_image_url: string;
    website: string;
    calendly_url: string;
    linkedin_url: string;
    instagram_url: string;
    twitter_url: string;
    youtube_url: string;
    spotify_url: string;
    rate_range: string;
    site_template: string;
    site_headline: string;
    site_bio: string;
    site_sections: any;
    site_custom_blocks: ContentBlock[];
    professional_skills: any;
    username?: string;
  };
  services: any[];
  credits: any[];
  reviews: any[];
  endorsements: any[];
}

const CreatorSite = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CreatorSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSiteViewTracker(!loading && !notFound && data ? data.profile.user_id : undefined);

  useEffect(() => {
    const fetchSiteData = async () => {
      if (!userId) { setNotFound(true); setLoading(false); return; }
      if (authLoading) return;

      // RLS on the base `profiles` table is owner-only as of migration
      // 20260502224404, so a raw `.from('profiles')` read here returned
      // nothing for any visitor besides the site's own owner — the exact
      // bug this fixes (an anonymous visitor, or any other logged-in user,
      // opening a shared creator-site link got "Site Not Found").
      //
      // The owner keeps reading their own row directly (works today via
      // RLS) because it's the only path that exposes site_enabled /
      // subscription_tier (the gate below) and the actual page content —
      // site_template, site_headline, site_bio, site_sections,
      // site_custom_blocks. None of those are in public_profiles_safe yet.
      // Everyone else goes through that view — the existing, already-
      // granted-to-anon safe path CreatorEPK already uses — but since the
      // gate and the template content aren't in it, a non-owner can't be
      // shown the actual custom site under the current schema; they fall
      // back to the regular profile page below instead of a dead "Site Not
      // Found", which is the best available fix without a follow-up
      // migration extending the safe view/RPC to cover the site-builder
      // columns (tracked alongside CreatorEPK's own documented field-gap
      // in PASSPORT_AND_CONVERSION_AUDIT.md).
      const isOwner = !!user && user.id === userId;
      const { data: profile, error } = isOwner
        ? await supabase
            .from('profiles')
            .select('user_id, full_name, role, bio, location, avatar_url, cover_image_url, website, calendly_url, linkedin_url, instagram_url, twitter_url, youtube_url, spotify_url, rate_range, site_template, site_enabled, site_headline, site_bio, site_sections, site_custom_blocks, professional_skills, subscription_tier, username')
            .eq('user_id', userId)
            .maybeSingle()
        : await supabase
            .from('public_profiles_safe')
            .select('user_id, full_name, role, bio, location, avatar_url, cover_image_url, linkedin_url, instagram_url, twitter_url, youtube_url, spotify_url, professional_skills, username')
            .eq('user_id', userId)
            .maybeSingle();

      if (error || !profile) { setNotFound(true); setLoading(false); return; }

      // Check if site is enabled and user has pro access. For a non-owner
      // read, site_enabled/subscription_tier are always absent (see above),
      // so this intentionally — and safely — falls through to the regular
      // profile page rather than ever rendering a template with no content.
      const proTiers = ['pro', 'creator_pro', 'founder'];
      const hasPro = proTiers.includes((profile as any).subscription_tier || '');

      if (!(profile as any).site_enabled || !hasPro) {
        // Redirect to regular profile
        navigate(`/profile/${userId}`, { replace: true });
        return;
      }

      // Fetch all supporting data in parallel
      const [servicesRes, creditsRes, reviewsRes, endorsementsRes] = await Promise.all([
        supabase
          .from('creator_services')
          .select('id, title, description, category, cover_image_url, delivery_time, tags, service_format')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('display_order'),

        supabase
          .from('credits')
          .select('id, project_name, role, year, credit_category, thumbnail_url, primary_media_url, verification_status, platform')
          .eq('user_id', userId)
          .order('year', { ascending: false })
          .limit(12),

        supabase
          .from('company_reviews')
          .select('id, rating, review_text, created_at, reviewer_id')
          .eq('company_id', userId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(6),

        supabase
          .from('credit_endorsements')
          .select('id, testimonial, endorser_name, relationship, status')
          .eq('status', 'endorsed')
          .in('credit_id', 
            (await supabase.from('credits').select('id').eq('user_id', userId)).data?.map((c: any) => c.id) || []
          )
          .limit(6),
      ]);

      // Fetch service tiers for each service
      const serviceIds = (servicesRes.data || []).map((s: any) => s.id);
      let tiers: any[] = [];
      if (serviceIds.length > 0) {
        const { data: tierData } = await supabase
          .from('service_tiers')
          .select('*')
          .in('service_id', serviceIds)
          .order('price');
        tiers = tierData || [];
      }

      // Attach tiers to services
      const servicesWithTiers = (servicesRes.data || []).map((s: any) => ({
        ...s,
        tiers: tiers.filter(t => t.service_id === s.id),
      }));

      setData({
        profile: { ...(profile as any), site_custom_blocks: (profile as any).site_custom_blocks || [] },
        services: servicesWithTiers,
        credits: creditsRes.data || [],
        reviews: reviewsRes.data || [],
        endorsements: endorsementsRes.data || [],
      });
      setLoading(false);
    };

    fetchSiteData();
  }, [userId, navigate, user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0c] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-dvh bg-[#0a0a0c] flex flex-col items-center justify-center text-white gap-4">
        <h1 className="text-2xl font-bold">Site Not Found</h1>
        <p className="text-zinc-400">This creator hasn't set up their site yet.</p>
        <button onClick={() => navigate('/')} className="text-white hover:text-[#FF2DA1] hover:underline transition-colors">
          Go to Kretopia →
        </button>
      </div>
    );
  }

  const template = data.profile.site_template || 'bold-electric';
  // /:username is the canonical, shareable form of this same page (see
  // CreatorSiteByUsername.tsx) -- point search engines there when a
  // username exists so ranking signal isn't split across two URLs for the
  // same content, and fall back to this page's own URL otherwise.
  const canonicalUrl = data.profile.username
    ? `${APP_URL}/${data.profile.username}`
    : `${APP_URL}/site/${userId}`;

  return (
    <>
      <SEO
        title={`${data.profile.full_name} — ${data.profile.role || 'Creator'}`}
        description={data.profile.bio?.slice(0, 160) || `${data.profile.full_name}'s professional site powered by Kretopia`}
        type="profile"
        image={data.profile.avatar_url || data.profile.cover_image_url || undefined}
        url={canonicalUrl}
        profile={{
          name: data.profile.full_name,
          role: data.profile.role,
          location: data.profile.location,
          avatar: data.profile.avatar_url,
          bio: data.profile.bio,
          socialLinks: {
            instagram: data.profile.instagram_url,
            twitter: data.profile.twitter_url,
            linkedin: data.profile.linkedin_url,
            youtube: data.profile.youtube_url,
            website: data.profile.website,
          },
        }}
      />
      {template === 'bold-electric' && <BoldElectricTemplate data={data} />}
      {template === 'minimal-editorial' && <MinimalEditorialTemplate data={data} />}
      {template === 'portfolio-mosaic' && <PortfolioMosaicTemplate data={data} />}
      {template === 'creative-director' && <CreativeDirectorTemplate data={data} />}
      {template === 'artist-showcase' && <ArtistShowcaseTemplate data={data} />}
      {template === 'producer' && <ProducerTemplate data={data} />}
      {template === 'agency' && <AgencyTemplate data={data} />}
      {template === 'minimal-clean' && <MinimalCleanTemplate data={data} />}
      {template === 'photographer' && <PhotographerTemplate data={data} />}
      {!['bold-electric', 'minimal-editorial', 'portfolio-mosaic', 'creative-director', 'artist-showcase', 'producer', 'agency', 'minimal-clean', 'photographer'].includes(template) && <BoldElectricTemplate data={data} />}
    </>
  );
};

export default CreatorSite;
