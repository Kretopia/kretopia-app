import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { APP_URL } from "@/lib/constants";
import { BoldElectricTemplate } from "@/components/creator-site/BoldElectricTemplate";
import { MinimalEditorialTemplate } from "@/components/creator-site/MinimalEditorialTemplate";
import { PortfolioMosaicTemplate } from "@/components/creator-site/PortfolioMosaicTemplate";
import { CreativeDirectorTemplate } from "@/components/creator-site/CreativeDirectorTemplate";
import { ArtistShowcaseTemplate } from "@/components/creator-site/ArtistShowcaseTemplate";
import { ProducerTemplate } from "@/components/creator-site/ProducerTemplate";
import { AgencyTemplate } from "@/components/creator-site/AgencyTemplate";
import { MinimalCleanTemplate } from "@/components/creator-site/MinimalCleanTemplate";
import { PhotographerTemplate } from "@/components/creator-site/PhotographerTemplate";
import HandleResolver from "@/pages/HandleResolver";
import { useSiteViewTracker } from "@/hooks/useSiteAnalytics";
import type { CreatorSiteData } from "@/pages/CreatorSite";

/**
 * Resolves /:username to the creator's site and renders it directly
 * (no redirect to /site/:userId so the clean URL stays in the address bar).
 */
const CreatorSiteByUsername = () => {
  const { username } = useParams<{ username: string }>();
  const isHandle = !!username && username.startsWith("@");
  const navigate = useNavigate();
  const [data, setData] = useState<CreatorSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSite, setIsSite] = useState(false);

  useSiteViewTracker(!loading && data ? data.profile.user_id : undefined);

  // Hide platform nav when rendering a creator site
  useEffect(() => {
    if (isSite) {
      document.body.classList.add('creator-site-active');
      return () => { document.body.classList.remove('creator-site-active'); };
    }
  }, [isSite]);

  useEffect(() => {
    const resolve = async () => {
      if (!username || isHandle) {
        if (!username) navigate("/", { replace: true });
        return;
      }

      // Guard: never treat reserved platform paths as usernames.
      // This prevents "/index", "/home", etc. from rendering the dark
      // "Site Not Found" screen when a stale link or typo is hit.
      const RESERVED_PATHS = new Set([
        "index", "home", "auth", "login", "signup", "logout",
        "admin", "settings", "profile", "messages", "notifications",
        "circle", "circles", "desk", "fund", "thrivepay", "subscription",
        "search", "nearby", "spotlight", "opportunities", "gigs",
        "onboarding", "company-onboarding", "claim", "install",
        "about", "terms", "privacy", "unsubscribe", "community-guidelines",
        "talent-finder", "talent-manager", "shortlists", "website-builder",
      ]);
      if (RESERVED_PATHS.has(username.toLowerCase())) {
        navigate("/", { replace: true });
        return;
      }

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
      const SELECT_COLS = "user_id, full_name, role, bio, location, avatar_url, cover_image_url, website, calendly_url, linkedin_url, instagram_url, twitter_url, youtube_url, spotify_url, rate_range, site_template, site_enabled, site_headline, site_bio, site_sections, site_custom_blocks, professional_skills, subscription_tier, username";

      // public_profiles_safe, not raw profiles: RLS only allows a profile's
      // owner to read their row directly, so a visitor loading someone
      // else's public site by username would otherwise get zero rows back.
      let profile: any = null;
      if (isUuid) {
        const { data } = await supabase.from("public_profiles_safe").select(SELECT_COLS).eq("user_id", username).maybeSingle();
        profile = data;
      } else {
        const { data } = await supabase.from("public_profiles_safe").select(SELECT_COLS).eq("username", username.toLowerCase()).maybeSingle();
        profile = data;
      }

      // If passed a UUID, always send to the canonical profile page (creator-site only works via username).
      if (isUuid && profile) {
        navigate(`/profile/${profile.user_id}`, { replace: true });
        return;
      }

      if (!profile) {
        navigate("/", { replace: true });
        return;
      }

      const proTiers = ["pro", "creator_pro", "founder"];
      const hasPro = proTiers.includes(profile.subscription_tier || "");

      if (!profile.site_enabled || !hasPro) {
        navigate(`/profile/${profile.user_id}`, { replace: true });
        return;
      }

      setIsSite(true);

      const userId = profile.user_id;
      const [servicesRes, creditsRes, reviewsRes, endorsementsRes] = await Promise.all([
        supabase.from("creator_services").select("id, title, description, category, cover_image_url, delivery_time, tags, service_format").eq("user_id", userId).eq("is_active", true).order("display_order"),
        supabase.from("credits").select("id, project_name, role, year, credit_category, thumbnail_url, primary_media_url, verification_status, platform").eq("user_id", userId).order("year", { ascending: false }).limit(12),
        supabase.from("company_reviews").select("id, rating, review_text, created_at, reviewer_id").eq("company_id", userId).eq("status", "published").order("created_at", { ascending: false }).limit(6),
        supabase.from("credit_endorsements").select("id, testimonial, endorser_name, relationship, status").eq("status", "endorsed").in("credit_id", (await supabase.from("credits").select("id").eq("user_id", userId)).data?.map((c: any) => c.id) || []).limit(6),
      ]);

      const serviceIds = (servicesRes.data || []).map((s: any) => s.id);
      let tiers: any[] = [];
      if (serviceIds.length > 0) {
        const { data: tierData } = await supabase.from("service_tiers").select("*").in("service_id", serviceIds).order("price");
        tiers = tierData || [];
      }

      const servicesWithTiers = (servicesRes.data || []).map((s: any) => ({
        ...s,
        tiers: tiers.filter((t) => t.service_id === s.id),
      }));

      setData({
        profile: { ...profile, site_custom_blocks: (profile.site_custom_blocks as any) || [] },
        services: servicesWithTiers,
        credits: creditsRes.data || [],
        reviews: reviewsRes.data || [],
        endorsements: endorsementsRes.data || [],
      });
      setLoading(false);
    };

    resolve();
  }, [username, navigate]);

  if (isHandle) {
    return <HandleResolver mode="handle" />;
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center text-foreground gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Site Not Found</h1>
        <p className="text-muted-foreground">This creator hasn't set up their site yet.</p>
        <button onClick={() => navigate("/")} className="text-white hover:text-[#FF2DA1] hover:underline transition-colors">
          Go to Kretopia →
        </button>
      </div>
    );
  }

  const template = data.profile.site_template || "bold-electric";

  const canonicalUrl = `${APP_URL}/${username}`;

  return (
    <>
      <SEO
        title={`${data.profile.full_name} — ${data.profile.role || "Creator"}`}
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

export default CreatorSiteByUsername;
