import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Verified, MapPin, ArrowRight, TrendingUp, Users, PlusCircle, CalendarDays, ChevronRight, Zap, Play, Star, Globe, Shield, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { QuickPostModal } from "@/components/QuickPostModal";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ProfileCompletionCard } from "@/components/ProfileCompletionCard";
import { PassportPreviewCard } from "@/components/passport/PassportPreviewCard";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";

import { CreditThumb } from "@/components/onboarding/claim-flow/CreditThumb";
// ProfileHubCard removed from Home — Passport tab covers profile surface.
import { DiscoverCreativesRow } from "@/components/landing/DiscoverCreativesRow";
import { OAuthQuickButtons } from "@/components/landing/OAuthQuickButtons";
// Hero visual is now <HeroPhoneCarousel /> — no static image needed.

import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { PricingPreviewSection } from "@/components/landing/PricingPreviewSection";
import { HeroPhoneCarousel } from "@/components/landing/HeroPhoneCarousel";
import { ClaimYourCreditsSection } from "@/components/landing/ClaimYourCreditsSection";
import { ProductReelSection } from "@/components/landing/ProductReelSection";
import { ComparisonTableSection } from "@/components/landing/ComparisonTableSection";
import { ThriveFundTeaserCard } from "@/components/landing/ThriveFundTeaserCard";
import { CoreValueBlocks } from "@/components/landing/CoreValueBlocks";
import { BottomCTASection } from "@/components/landing/BottomCTASection";

// KretopiaLanding is the entire guest landing page (hero + all chapters,
// including FAQSection) — route-split so logged-in users, who never render
// it, don't pay for it in the shared UnifiedHome chunk.
const KretopiaLanding = lazy(
  () => import("@/components/landing/KretopiaLanding").then((m) => ({ default: m.KretopiaLanding })),
);
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { InviteCircleCard } from "@/components/InviteCircleCard";
// import { StartCircleNudgeCard } from "@/components/home/StartCircleNudgeCard"; // Hidden in Pass A
// Prune: NewMemberStarterCard, FoundingMemberCard, MagicHomeHero, OpportunityIntelCard,
// WeeklyIntentCard, ThriveFundFeedRow, EventsNearYouSection moved off Home → live on their own surfaces.
import { FirstWinSheet } from "@/components/onboarding/FirstWinSheet";
import { RecentIntentsDrawer } from "@/components/home/RecentIntentsDrawer";
import { PersonaCardsRow } from "@/components/home/PersonaCardsRow";
import { TodayDashboard } from "@/components/today/TodayDashboard";
// SpotlightFeedRow removed from Home — lives at /spotlight only.
// LiveGigsStrip removed — see Smart Gig Scout
// ThriveFundShowcase replaced by compact ThriveFundTeaserCard on landing
import GigCard from "@/components/opportunity/GigCard";
import { GigRailCard } from "@/components/opportunity/GigRailCard";
import { intentBoostForCreator, intentBoostForGig, intentBoostForEvent } from "@/lib/intentMatching";
import { normalizeIntents } from "@/lib/intents";
import { useCurrentGeoCountry } from "@/hooks/useCurrentGeoCountry";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";


const HERO_ROLES = ["Filmmaker", "Musician", "Photographer", "Designer", "Producer", "Artist", "Director", "Dancer", "Event Producer", "DJ", "Stylist", "Choreographer", "Animator", "Content Creator", "MC"];

// Simulated live activity for social proof
const ACTIVITY_TEMPLATES = [
  (n: string) => `${n} just claimed a credit on a new production`,
  (n: string) => `${n} got verified as a professional creator`,
  (n: string) => `${n} landed a gig through Kretopia`,
  (n: string) => `${n} joined the creative community`,
];

export const UnifiedHome = () => {
  const { user, subscriptionInfo, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const isPro = hasProAccess(subscriptionInfo.tier as any);
  const navigate = useNavigate();
  const [quickPostType, setQuickPostType] = useState<"gig" | "event" | null>(null);
  const [heroRoleIdx, setHeroRoleIdx] = useState(0);
  const { geo: currentGeo } = useCurrentGeoCountry();
  const reducedMotion = useReducedMotion();
  const [peopleForYouApi, setPeopleForYouApi] = useState<CarouselApi>();

  // Dashboard data
  const [trendingCredits, setTrendingCredits] = useState<any[]>([]);
  const [featuredCreators, setFeaturedCreators] = useState<any[]>([]);
  const [activeGigs, setActiveGigs] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ creators: 0, credits: 0, gigs: 0, connections: 0 });

  const handleHeroClaimSearch = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;

    const cacheKey = `claim_search:${q.toLowerCase()}`;
    try {
      let results: any[] = [];
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.ts && Date.now() - cached.ts < 24 * 60 * 60 * 1000 && Array.isArray(cached.results)) {
          results = cached.results;
        }
      }

      if (results.length === 0) {
        const { data } = await supabase.functions.invoke("search-credits-web", { body: { query: q } });
        results = data?.results || [];
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), query: q, results }));
      }

      sessionStorage.setItem("claim_intent", JSON.stringify({ q, source: "landing", results, ts: Date.now() }));
    } catch (err) {
      console.warn("[home-claim-search] prefetch failed", err);
      try {
        sessionStorage.setItem("claim_intent", JSON.stringify({ q, source: "landing", results: [], ts: Date.now() }));
      } catch {}
    } finally {
      navigate(`/auth?tab=signup&claim=1&q=${encodeURIComponent(q)}`);
    }
  };

  // Auth-only data
  const [profile, setProfile] = useState<any>(null);
  const [profileFull, setProfileFull] = useState<any>(null);
  const [myCredits, setMyCredits] = useState(0);
  const [myConnections, setMyConnections] = useState(0);

  // Live activity pulse
  const [activityMsg, setActivityMsg] = useState("");
  const [activityNames, setActivityNames] = useState<string[]>([]);

  // First-Win celebration sheet (one-shot for fresh accounts)
  const [showFirstWin, setShowFirstWin] = useState(false);

  // Rotate hero roles
  useEffect(() => {
    if (user) return;
    const interval = setInterval(() => setHeroRoleIdx(i => (i + 1) % HERO_ROLES.length), 2500);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch public dashboard data + personalized data for auth users
  useEffect(() => {
    const fetchPublic = async () => {
      let myProfile: any = null;
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role, professional_skills, passion_skills, location, primary_intent, primary_intents")
          .eq("user_id", user.id)
          .single();
        myProfile = data;
      }

      const mySkills: string[] = [];
      if (myProfile) {
      const extractSkills = (skills: any): string[] => {
          if (Array.isArray(skills)) return skills.map((s: any) => typeof s === 'string' ? s : (s?.skill || '')).filter(Boolean);
          if (skills && typeof skills === 'object') return Object.keys(skills);
          return [];
        };
        mySkills.push(...extractSkills(myProfile.professional_skills));
        mySkills.push(...extractSkills(myProfile.passion_skills));
      }
      const myRole = myProfile?.role || "";
      const myLocation = myProfile?.location || "";
      const myIntents = normalizeIntents(myProfile?.primary_intents ?? myProfile?.primary_intent);

      let creditsQuery = supabase
        .from("credits")
        .select("id, project_name, role, verification_status, credit_category, thumbnail_url, primary_media_url, url, project_type, user_id, year")
        .not("thumbnail_url", "is", null)
        .order("created_at", { ascending: false });

      if (user) {
        creditsQuery = creditsQuery.neq("user_id", user.id);
      }

      let gigsQuery = supabase
        .from("opportunities")
        .select("id, title, description, type, location, created_at, skills, tags, compensation, duration, image_url, status, barter_offering, barter_requesting, platform_requirements, min_followers, is_priority, priority_expires_at, scouted_by, created_by")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(12);

      // Use the public-readable view so signed-in users see OTHER real creators,
      // not just themselves (profiles table RLS hides non-connected rows).
      // "Real Passport" = the same 3 signals the redesigned Passport card
      // needs to be worth showing: a photo, a name, a role for RoleStamp to
      // read, and onboarding actually finished -- not a half-abandoned signup.
      let creatorsQuery = supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url, cover_image_url, role, verification_tier, location, professional_skills")

        .not("avatar_url", "is", null)
        .not("full_name", "is", null)
        .not("role", "is", null)
        .eq("onboarding_completed", true)
        .order("created_at", { ascending: false })
        .limit(40);
      if (user) {
        creatorsQuery = creatorsQuery.neq("user_id", user.id);
      }

      const [creditsRes, creatorsRes, gigsRes, publicStatsRes, eventsRes] = await Promise.all([
        creditsQuery.limit(20),
        creatorsQuery,
        gigsQuery,
        supabase.functions.invoke("public-stats"),
        (async () => {
          // Prefer CURRENT GPS country (great for travelers); fall back to profile.location.
          let userCountry: string | null = currentGeo?.country || null;
          if (!userCountry) {
            const loc = (myProfile as any)?.location || "";
            const parts = String(loc).split(",").map((s: string) => s.trim()).filter(Boolean);
            userCountry = parts.length > 1 ? parts[parts.length - 1] : null;
          }
          if (userCountry) {
            // Show events explicitly tagged to the user's country OR with no country (likely local/community-posted).
            // NEVER show events tagged to a different country.
            return await supabase.from("creative_jams")
              .select("id, title, start_time, venue_name, category, cover_image_url, created_by, country")
              .eq("is_public", true)
              .gte("start_time", new Date().toISOString())
              .or(`country.eq.${userCountry},country.is.null`)
              .order("start_time", { ascending: true })
              .limit(8);
          }
          // No country detected — show everything upcoming.
          return await supabase.from("creative_jams")
            .select("id, title, start_time, venue_name, category, cover_image_url, created_by, country")
            .eq("is_public", true)
            .gte("start_time", new Date().toISOString())
            .order("start_time", { ascending: true })
            .limit(8);
        })(),
      ]);

      let credits = creditsRes.data || [];
      if (user && mySkills.length > 0 && credits.length > 0) {
        const skillsLower = mySkills.map(s => s.toLowerCase());
        const roleLower = myRole.toLowerCase();
        credits = credits
          .map((c: any) => {
            let relevance = 0;
            const cRole = (c.role || "").toLowerCase();
            const cCategory = (c.credit_category || "").toLowerCase();
            const cProject = (c.project_name || "").toLowerCase();
            if (roleLower && (cRole.includes(roleLower) || cCategory.includes(roleLower))) relevance += 3;
            skillsLower.forEach(sk => {
              if (cRole.includes(sk) || cCategory.includes(sk) || cProject.includes(sk)) relevance += 2;
            });
            if (c.verification_status === "verified") relevance += 1;
            return { ...c, _relevance: relevance };
          })
          .sort((a: any, b: any) => b._relevance - a._relevance)
          .slice(0, 8);
      } else {
        credits = credits.slice(0, 8);
      }
      setTrendingCredits(credits);

      let gigs = gigsRes.data || [];
      if (user && mySkills.length > 0 && gigs.length > 0) {
        const skillsLower = mySkills.map(s => s.toLowerCase());
        const roleLower = myRole.toLowerCase();
        gigs = gigs
          .map((g: any) => {
            let relevance = 0;
            const title = (g.title || "").toLowerCase();
            const type = (g.type || "").toLowerCase();
            const required = Array.isArray(g.skills) ? g.skills.map((s: string) => (s || '').toLowerCase()) : [];
            skillsLower.forEach(sk => {
              if (required.some((r: string) => r.includes(sk) || sk.includes(r))) relevance += 3;
              if (title.includes(sk)) relevance += 2;
            });
            if (roleLower && (title.includes(roleLower) || type.includes(roleLower))) relevance += 2;
            if (myLocation && g.location && g.location.toLowerCase().includes(myLocation.toLowerCase().split(",")[0].trim())) relevance += 1;
            // Intent boost — viewers with "gigs" intent see paid work first
            relevance += intentBoostForGig(myIntents);
            return { ...g, _relevance: relevance };
          })
          .sort((a: any, b: any) => b._relevance - a._relevance)
          .slice(0, 8);
      } else {
        gigs = gigs.slice(0, 8);
      }
      setActiveGigs(gigs);

      let creators = creatorsRes.data || [];
      if (user && creators.length > 0) {
        const skillsLower = mySkills.map(s => s.toLowerCase());
        const roleLower = myRole.toLowerCase();
        const locationCity = myLocation.toLowerCase().split(",")[0].trim();
        creators = creators
          .map((c: any) => {
            let relevance = 0;
            const cRole = (c.role || "").toLowerCase();
            const cLocation = (c.location || "").toLowerCase();
            const cSkills = Array.isArray(c.professional_skills)
              ? c.professional_skills.filter((s: any) => typeof s === 'string').map((s: string) => s.toLowerCase())
              : (c.professional_skills ? Object.keys(c.professional_skills).map(s => s.toLowerCase()) : []);
            cSkills.forEach((cs: string) => {
              if (!skillsLower.includes(cs)) relevance += 2;
              if (skillsLower.includes(cs)) relevance += 1;
            });
            if (roleLower && cRole && cRole !== roleLower) relevance += 1;
            if (locationCity && cLocation.includes(locationCity)) relevance += 3;
            if (c.verification_tier === "verified" || c.verification_tier === "pro") relevance += 1;
            // Intent boost — complementary intents (gigs↔hire, collab↔collab, fund↔collab)
            const { boost, reason } = intentBoostForCreator(myIntents, c.primary_intents ?? c.primary_intent);
            relevance += boost;
            // Friendly fallback reason + score so the card always explains "why"
            const sharedSkill = cSkills.find((s: string) => skillsLower.includes(s));
            const sameCity = !!(locationCity && cLocation.includes(locationCity));
            const fallbackReason =
              reason ||
              (sharedSkill && `Shares your ${sharedSkill} skills`) ||
              (sameCity && `Based in ${(c.location || "").split(",")[0]}`) ||
              (cRole && `${c.role} you may want to collab with`) ||
              "Active creator on Kretopia";
            const score = Math.min(95, 60 + relevance * 4);
            return { ...c, _relevance: relevance, _intentReason: reason, match_score: score, reason: fallbackReason };
          })
          .sort((a: any, b: any) => b._relevance - a._relevance)
          .slice(0, 10);
      }
      setFeaturedCreators(creators);

      setUpcomingEvents(eventsRes.data || []);
      const ps = (publicStatsRes as any)?.data?.stats || {};
      setStats({ creators: ps.creators || 0, credits: ps.credits || 0, gigs: ps.gigs || 0, connections: ps.connections || 0 });

      setActivityNames(creators.filter((c: any) => c.full_name).map((c: any) => c.full_name.split(" ")[0]));

      const missing = credits.filter((c: any) => !c.thumbnail_url);
      if (missing.length > 0) {
        for (const credit of missing.slice(0, 4)) {
          supabase.functions.invoke('scrape-thumbnail', {
            body: { credit_id: credit.id, project_name: credit.project_name, url: credit.url, project_type: credit.project_type },
          }).then(({ data }) => {
            if (data?.image_url) {
              setTrendingCredits(prev => prev.map(c => c.id === credit.id ? { ...c, thumbnail_url: data.image_url } : c));
            }
          }).catch(() => {});
        }
      }
    };
    fetchPublic();
  }, [user, currentGeo?.country]);

  // Real AI-matched creators for the "Creators For You" rail (signed-in only).
  // Uses the canonical matchmaker (get-onboarding-matches) so reasons + scores
  // are consistent with Match. Falls back silently to the relevance-ranked list above.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.functions
      .invoke("get-onboarding-matches")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const matches = (data as any)?.matches;
        if (Array.isArray(matches) && matches.length > 0) {
          setFeaturedCreators(matches);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Live activity ticker
  useEffect(() => {
    if (activityNames.length === 0) return;
    const tick = () => {
      const name = activityNames[Math.floor(Math.random() * activityNames.length)];
      const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      setActivityMsg(template(name));
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [activityNames]);

  // Fetch auth-specific data
  useEffect(() => {
    if (!user) return;
    const fetchAuth = async () => {
      const [profileFullRes, creditsCount, connectionsCount] = await Promise.all([
        supabase.from("profiles").select(PROFILE_SELECT).eq("user_id", user.id).maybeSingle(),
        supabase.from("credits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("connections").select("id", { count: "exact", head: true }).or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`).eq("status", "accepted"),
      ]);
      // PROFILE_SELECT is a superset of the narrower field list this used to
      // fetch separately — one query covers both `profile` and `profileFull`.
      setProfile(profileFullRes.data);
      setProfileFull(profileFullRes.data);
      setMyCredits(creditsCount.count || 0);
      setMyConnections(connectionsCount.count || 0);

      // First-Win one-shot — fresh accounts that haven't seen it
      const seen = localStorage.getItem(`first_win_seen_${user.id}`);
      const created = profileFullRes.data?.created_at ? new Date(profileFullRes.data.created_at).getTime() : 0;
      const ageHrs = (Date.now() - created) / 3_600_000;
      if (!seen && ageHrs < 24 && profileFullRes.data?.onboarding_completed) {
        setTimeout(() => setShowFirstWin(true), 600);
      }
    };
    fetchAuth();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "Creator";

  const peopleForYouNode =
    featuredCreators.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">People for you</p>
          <Link to="/match" className="text-[11px] font-semibold text-primary hover:underline">See all</Link>
        </div>
        <Carousel
          setApi={setPeopleForYouApi}
          opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }}
          className="w-full"
          aria-label="People for you"
        >
          <CarouselContent className="-ml-3">
            {featuredCreators.slice(0, 10).map((c: any) => (
              <CarouselItem key={c.user_id} className="pl-3 basis-auto">
                <PassportPreviewCard
                  userId={c.user_id}
                  fullName={c.full_name}
                  avatarUrl={c.avatar_url}
                  coverImageUrl={c.cover_image_url}
                  role={c.role}
                  subRoles={c.sub_roles}
                  matchScore={c.match_score}
                  reason={c.reason}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous — people for you" />
          <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next — people for you" />
        </Carousel>
        <CarouselPositionDots api={peopleForYouApi} label="People for you" />
      </div>
    ) : undefined;

  return (
    <div className="bg-background min-h-screen accent-passport">
      <SEO
        title="Kretopia — Where Creativity Lives. The Creative Economy OS."
        description="Kretopia is the Creative Economy OS. Build your Creative Passport, find opportunities, meet collaborators, and get paid — with Kreto, your Executive Producer."
        url="https://www.kretopia.com/"
      />

      {/* ═══════════ GUEST LANDING — Kretopia v1 (now canonical) ═══════════ */}
      {/* Never show the public hero while the session is still resolving —
          otherwise signed-in users bounce back to the landing page on refresh. */}
      {!user && !authLoading && (
        <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: "#05070D" }} aria-busy="true" />}>
          <KretopiaLanding onSearchSubmit={handleHeroClaimSearch} />
        </Suspense>
      )}
      {!user && authLoading && <div className="min-h-[60vh]" aria-busy="true" />}


      {/* Live gigs strip removed — Smart Gig Scout is the new front door */}


      {/* ═══════════ AUTH HUB ═══════════
          Render as soon as we know there's a user — don't wait for the
          profile fetch. TodayDashboard (src/components/today/) is the one
          composed command-center surface: greeting + Passport readiness +
          priority action, momentum, then next moves -- it loads its own
          data and skeleton, so gating the whole hub on `profile` left
          mobile blank for ~500ms+ on slow nets. */}
      {user && (
        <StudioFeatureShell>
          <TodayDashboard
            firstName={firstName}
            peopleForYou={peopleForYouNode}
            profile={profile}
            profileFull={profileFull}
            myCredits={myCredits}
          />
        </StudioFeatureShell>
      )}

      {/* ═══════════ CONTENT SECTIONS ═══════════
          Authed-only: the guest narrative (8-section legacy landing) was
          retired -- Kretopia v1's KretopiaLanding + EditorialFooter above
          now own the entire guest experience, including the footer. This
          wrapper's only remaining content (footer links, QuickPostModal)
          is authed-only, so the wrapper itself must be too -- otherwise
          guests get a bare `pb-28` (112px) empty block below the real
          footer with nothing in it. */}
      {user && (
        <div className="mx-auto px-3 sm:px-4 pb-28 max-w-7xl">
          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground mt-10 pb-4">
            <Link to="/about" className="hover:text-foreground transition-colors">{t("common.about")}</Link>
            <span className="text-border">·</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">{t("common.terms")}</Link>
            <span className="text-border">·</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">{t("common.privacy")}</Link>
            <span className="text-border">·</span>
            <Link to="/community-guidelines" className="hover:text-foreground transition-colors">{t("footer.guidelines")}</Link>
          </div>

          <QuickPostModal open={quickPostType !== null} onOpenChange={(open) => !open && setQuickPostType(null)} type={quickPostType || "gig"} />
        </div>
      )}
      {user && <FirstWinSheet open={showFirstWin} onOpenChange={setShowFirstWin} />}
      {!user && <StickyMobileCTA />}
    </div>
  );
};

export default UnifiedHome;
