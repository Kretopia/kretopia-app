import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MediaPlayerModal } from "@/components/profile/MediaPlayerModal";
import { ClaimProfileDialog } from "@/components/profile/ClaimProfileDialog";
import { EPKShareToolbar } from "@/components/epk/EPKShareToolbar";
import { EPKReviews } from "@/components/epk/EPKReviews";
import { EPKFooterCTA } from "@/components/epk/EPKFooterCTA";
import { PublicPassportHero } from "@/components/passport/PublicPassportHero";
import { ModelStrip } from "@/components/passport/model/ModelStrip";
import { VideoIntroSection } from "@/components/profile/VideoIntroSection";
import { RateCardSection } from "@/components/profile/RateCardSection";
import { getMediaThumbnail } from "@/lib/mediaUtils";
import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import { StartProjectFromMatchDialog } from "@/components/project/StartProjectFromMatchDialog";
import { InviteToProjectDialog } from "@/components/project/InviteToProjectDialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { notifyUser } from "@/lib/notifyUser";
import { toast } from "sonner";
import {
  MapPin, 
  Globe, 
  Calendar, 
  ExternalLink,
  Play,
  Music,
  Image as ImageIcon,
  Star,
  Award,
  CheckCircle2,
  Sparkles,
  UserCheck,
  ArrowRight,
  Package,
  Download,
  Database
} from "lucide-react";
import { Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

interface Profile {
  full_name: string;
  role: string;
  bio: string;
  location: string;
  avatar_url: string;
  user_id: string;
  website?: string;
  calendly_url?: string;
  linkedin_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  youtube_url?: string;
  spotify_url?: string;
  behance_url?: string;
  imdb_url?: string;
  soundcloud_url?: string;
  average_rating?: number;
  total_reviews?: number;
  achievement_badges?: string[];
  verification_tier?: string;
  verification_status?: string;
  professional_skills?: any;
  passion_skills?: any;
  collab_intent?: string;
  rate_range?: string;
  is_claimed?: boolean;
  cover_image_url?: string;
  job_title?: string;
  video_intro_url?: string | null;
  headline?: string | null;
  username?: string | null;
  sub_roles?: string[] | null;
  profile_frame?: string | null;
  availability_status?: string | null;
  availability_note?: string | null;
  id_verified?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  payment_verified?: boolean;
  hourly_rate?: number;
  project_rate?: number;
  rate_currency?: string;
  avg_response_hours?: number;
}

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  media_url: string;
  media_type: string;
  thumbnail_url?: string;
}

interface Credit {
  id: string;
  project_name?: string;
  title?: string;
  role: string;
  year?: number;
  platform?: string;
  source?: string;
  thumbnail_url?: string;
  primary_media_url?: string;
  credit_category?: string;
  isVerified?: boolean;
  verificationTier?: 'icdb' | 'ai' | 'peer' | 'payment' | 'manual';
}

interface IndustryStat {
  id: string;
  title: string;
  value?: string;
  stat_type: string;
  issuer?: string;
}

// Decode HTML entities from scraped data
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const CreatorEPK = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [pressLinks, setPressLinks] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [industryStats, setIndustryStats] = useState<IndustryStat[]>([]);
  const [digitalProducts, setDigitalProducts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [isConnecting, setIsConnecting] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [collaborateOpen, setCollaborateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // Check if current user is the profile owner
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      if (!userId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // Public read goes through the safe view — RLS on the base `profiles`
        // table is owner-only as of migration 20260502224404 (deliberately
        // hardened; the old "RLS allows public read" assumption this line
        // used to rely on no longer holds). public_profiles_safe is the
        // existing, already-granted-to-anon safe path (same one HandleResolver
        // and Circle's Browse tab already use). Its column list is a subset
        // of what this page used to request — see CreatorEPK's field-gap note
        // in PASSPORT_AND_CONVERSION_AUDIT.md for what's temporarily absent
        // (is_claimed, website, calendly_url, collab_intent, rate_range,
        // average_rating, total_reviews, achievement_badges, passion_skills,
        // icdb_creator_id, job_title, sub_roles, model_stats, mother_agency,
        // model_unions, model_categories) until a follow-up migration extends
        // the view. Every downstream usage of these fields already handles
        // undefined gracefully (optional chaining / conditional rendering),
        // confirmed by reading each call site before making this change.
        const { data: profileData, error: profileError } = await supabase
          .from('public_profiles_safe')
          // Select the active safe-view shape instead of naming columns from a
          // newer schema snapshot. This keeps public Passports available while
          // production migrations propagate, without reading the base table.
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileError || !profileData) {
          console.error('Profile not found:', profileError);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setProfile(profileData as Profile);

        // Fetch all data in parallel
        const [portfolioRes, pressRes, awardsRes, creditsRes, statsRes, productsRes, icdbRes, reviewsRes] = await Promise.all([
          // Portfolio items (from credits with source=portfolio)
          supabase
            .from('credits')
            .select('id, project_name, description, primary_media_url, media_type, thumbnail_url')
            .eq('user_id', userId)
            .eq('source', 'portfolio')
            .order('created_at', { ascending: false })
            .limit(9),
          
          // Press links
          supabase
            .from('press_links')
            .select('id, title, publication, url, image_url')
            .eq('user_id', userId)
            .limit(4),
          
          // Awards
          supabase
            .from('awards')
            .select('id, title, organization, year')
            .eq('user_id', userId)
            .limit(4),
          
          // All Credits (work history) — include thumbnail + media
          supabase
            .from('credits')
            .select('id, project_name, role, year, platform, verification_status, ai_confidence, endorsement_count, source, thumbnail_url, primary_media_url, credit_category')
            .eq('user_id', userId)
            .order('year', { ascending: false })
            .limit(12),
          
          // Industry stats
          supabase
            .from('industry_stats')
            .select('id, title, value, stat_type, issuer')
            .eq('user_id', userId)
            .limit(6),
          
          // Digital products
          supabase
            .from('digital_products')
            .select('id, title, description, price, currency, product_type, preview_urls, download_count, tags')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(6),

          // ICDB claimed roles
          supabase
            .from('icdb_project_roles')
            .select('id, role_title, person_name, is_claimed, project_id')
            .eq('claimed_by', userId)
            .eq('is_claimed', true),

          // Reviews
          supabase
            .from('company_reviews')
            .select('id, rating, review_text, created_at, reviewer_id')
            .eq('company_id', userId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        setPortfolioItems((portfolioRes.data || []).map((c: any) => ({ id: c.id, title: c.project_name, description: c.description, media_url: c.primary_media_url, media_type: c.media_type, thumbnail_url: c.thumbnail_url })));
        setPressLinks(pressRes.data || []);
        setAwards(awardsRes.data || []);
        setIndustryStats(statsRes.data || []);
        setDigitalProducts(productsRes.data || []);
        setReviews((reviewsRes.data || []).map((r: any) => ({
          ...r,
          reviewer_name: 'Verified Client',
        })));
        
        // Process credits with verification tiers
        const manualCredits = (creditsRes.data || []).map((c: any) => {
          let tier: Credit['verificationTier'] = 'manual';
          if (c.verification_status === 'verified' && c.endorsement_count >= 2) tier = 'peer';
          else if (c.ai_confidence && c.ai_confidence >= 0.7) tier = 'ai';
          else if (c.source && c.source !== 'manual' && c.source !== 'portfolio') tier = 'ai';
          return {
            ...c,
            isVerified: tier !== 'manual',
            verificationTier: tier,
          };
        });

        // Kretopia Credits claimed credits
        const icdbClaimed = (icdbRes.data || []).map((c: any) => ({
          id: c.id,
          project_name: c.person_name || 'Claimed Credit',
          role: c.role_title,
          isVerified: true,
          verificationTier: 'icdb' as const,
        }));
        
        // Combine and sort by year
        const allCredits = [...icdbClaimed, ...manualCredits]
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, 12);
        
        setCredits(allCredits);

        // Auto-enrichment removed — users control their own credits

      } catch (error) {
        console.error('Error fetching profile:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [userId]);

  useEffect(() => {
    if (!currentUserId || !userId || currentUserId === userId) return;
    supabase
      .from('connections')
      .select('status')
      .or(`and(user_id.eq.${currentUserId},connected_user_id.eq.${userId}),and(user_id.eq.${userId},connected_user_id.eq.${currentUserId})`)
      .limit(1)
      .then(({ data }) => {
        const status = data?.[0]?.status;
        setConnectionStatus(status === 'accepted' ? 'connected' : status ? 'pending' : 'none');
      });
  }, [currentUserId, userId]);

  const handleConnect = async () => {
    if (!userId) return;
    if (!currentUserId) {
      navigate(`/auth?connect=${userId}`);
      return;
    }
    setIsConnecting(true);
    const { error } = await supabase.from('connections').insert({
      user_id: currentUserId,
      connected_user_id: userId,
      status: 'pending',
    });
    setIsConnecting(false);
    if (error) {
      if (error.code === '23505') {
        setConnectionStatus('pending');
        toast.info('Connection request already sent');
        return;
      }
      toast.error('Unable to send the connection request');
      return;
    }
    setConnectionStatus('pending');
    toast.success(`Connection request sent to ${profile?.full_name}`);
    await notifyUser({
      userId,
      title: 'New Connection Request',
      message: 'Someone wants to connect with you',
      type: 'connection',
      link: `/profile/${currentUserId}`,
      actionUrl: `/profile/${currentUserId}`,
      actionText: 'View Passport',
    });
  };

  const handleShare = async () => {
    const url = `${APP_URL}/epk/${userId}`;
    if (navigator.share) {
      await navigator.share({ title: `${profile?.full_name} | Kretopia`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Passport link copied');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <LoadingSpinner text="Opening creative Passport" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Profile Not Found</h1>
          <p className="text-muted-foreground">This creator profile doesn't exist or is not public.</p>
          <Button onClick={() => navigate('/')} variant="default">
            Visit Kretopia
          </Button>
        </div>
      </div>
    );
  }

  const getVerificationBadge = () => {
    if (profile.verification_tier === 'elite') {
      return { label: 'Elite Verified', color: 'bg-scout' };
    }
    if (profile.verification_tier === 'industry') {
      return { label: 'Industry Verified', color: 'bg-primary' };
    }
    if (profile.verification_status === 'verified') {
      return { label: 'Verified', color: 'bg-primary' };
    }
    return null;
  };

  const verificationBadge = getVerificationBadge();
  const isOwner = currentUserId === userId;
  const allSkills = [
    ...(Array.isArray(profile.professional_skills) 
      ? profile.professional_skills.map((s: any) => typeof s === 'string' ? s : s?.skill || s?.name).filter(Boolean)
      : []),
    ...(Array.isArray(profile.passion_skills)
      ? profile.passion_skills.map((s: any) => typeof s === 'string' ? s : s?.skill || s?.name).filter(Boolean)
      : [])
  ];

  const canonicalUrl = `${APP_URL}/epk/${userId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEO 
        title={`${profile.full_name} - ${profile.role || 'Creator'} | Kretopia`}
        description={profile.bio || `${profile.full_name} is a ${profile.role || 'creative professional'}${profile.location ? ` based in ${profile.location}` : ''}. View portfolio, work history, and connect on Kretopia.`}
        type="profile"
        image={profile.avatar_url || undefined}
        url={canonicalUrl}
        profile={{
          name: profile.full_name,
          role: profile.role,
          location: profile.location,
          avatar: profile.avatar_url,
          bio: profile.bio,
          skills: allSkills.slice(0, 20),
          socialLinks: {
            instagram: profile.instagram_url,
            twitter: profile.twitter_url,
            linkedin: profile.linkedin_url,
            youtube: profile.youtube_url,
            website: profile.website
          }
        }}
      />

      {/* Main Content - Mobile-first vertical layout */}
      <div className="max-w-lg mx-auto px-4 pt-6 pb-32">

        {/* Public Passport — same dominant identity treatment as the owner Passport. */}
        <div className="mb-8">
          <PublicPassportHero
            profile={profile}
            credits={credits}
            connectionStatus={connectionStatus}
            isOwner={isOwner}
            isSignedIn={Boolean(currentUserId)}
            isConnecting={isConnecting}
            onConnect={handleConnect}
            onMessage={() => setMessageOpen(true)}
            onCollaborate={() => setCollaborateOpen(true)}
            onAddToProject={() => setInviteOpen(true)}
            onShare={handleShare}
            onJoin={() => navigate(`/auth?connect=${userId}`)}
          />
        </div>

        {/* Owner Share Toolbar */}
        {isOwner && (
          <div ref={shareRef}>
            <EPKShareToolbar
              profileName={profile.full_name}
              profileRole={profile.role || 'Creator'}
              userId={userId || ''}
              epkPdfData={{
                profile,
                credits,
                awards,
                pressLinks,
                industryStats,
                reviews: reviews.map((r: any) => ({
                  reviewer_name: r.reviewer_name || r.reviewer?.full_name,
                  rating: r.rating,
                  review_text: r.review_text,
                })),
              }}
            />
          </div>
        )}

        {/* Video Intro — pinned high so the EPK feels alive */}
        {(profile.video_intro_url || isOwner) && (
          <div className="mb-6">
            <VideoIntroSection
              videoUrl={profile.video_intro_url || null}
              isOwnProfile={isOwner}
              onRefresh={() => window.location.reload()}
            />
          </div>
        )}

        {/* Model strip — casting-grade info, only when sub_roles includes model */}
        {((profile as any).sub_roles || []).includes?.('model') && (
          <ModelStrip
            userId={userId || ''}
            isOwner={isOwner}
            stats={(profile as any).model_stats}
            motherAgency={(profile as any).mother_agency}
            unions={(profile as any).model_unions}
            categories={(profile as any).model_categories}
          />
        )}

        {/* Why work with me — leads the press kit with positioning. */}
        {(profile.headline || profile.bio) && (() => {
          const longBio = profile.bio && profile.bio.length > 280;
          const body = profile.headline
            || (longBio && !bioExpanded ? `${profile.bio!.slice(0, 277)}…` : profile.bio);
          return (
            <div className="mb-6 p-5 rounded-xl border-l-4 border-primary bg-primary/5">
              <h3 className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-2">
                Why work with me
              </h3>
              <p className="text-base leading-relaxed text-foreground whitespace-pre-line">
                {body}
              </p>
              {!profile.headline && longBio && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setBioExpanded((v) => !v)}
                  className="mt-2 h-auto p-0 text-xs font-semibold text-primary"
                >
                  {bioExpanded ? "Show less" : "Read more"}
                </Button>
              )}
            </div>
          );
        })()}

        {/* Unclaimed Profile Banner */}
        {profile.is_claimed === false && (
          <div className="mb-6 p-4 rounded-xl bg-scout/10 border border-scout/30">
            <div className="flex items-center gap-2 text-scout mb-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold">Is this you?</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Claim this profile to unlock all features, connect with other creators, and manage your presence on Kretopia.
            </p>
            <Button 
              onClick={() => setShowClaimDialog(true)}
              className="w-full gap-2 bg-scout hover:opacity-90 border-0"
            >
              <UserCheck className="h-4 w-4" />
              Claim This Profile
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Claim Profile Dialog */}
        {profile.is_claimed === false && (
          <ClaimProfileDialog
            open={showClaimDialog}
            onOpenChange={setShowClaimDialog}
            profile={profile}
            onSuccess={() => navigate('/onboarding')}
          />
        )}

        {/* Professional Skills */}
        {profile.professional_skills && Array.isArray(profile.professional_skills) && profile.professional_skills.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Professional Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.professional_skills.slice(0, 10).map((skill: any, index: number) => (
                <Badge key={index} variant="secondary" className="px-3 py-1">
                  {typeof skill === 'string' ? skill : skill?.skill || skill?.name || 'Skill'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Passion Skills / Other Expertise */}
        {profile.passion_skills && Array.isArray(profile.passion_skills) && profile.passion_skills.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Also Skilled In
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.passion_skills.slice(0, 8).map((skill: any, index: number) => (
                <Badge key={index} variant="outline" className="px-3 py-1">
                  {typeof skill === 'string' ? skill : skill?.skill || skill?.name || 'Skill'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Collaboration Info */}
        {(profile.collab_intent || profile.rate_range) && (
          <div className="mb-6 p-4 rounded-lg bg-muted/50">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Availability
            </h3>
            <div className="space-y-2 text-sm">
              {profile.collab_intent && (
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">Looking for:</span>
                  <span className="font-medium capitalize">{profile.collab_intent.replace(/_/g, ' ')}</span>
                </p>
              )}
              {profile.rate_range && (
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">Rate:</span>
                  <span className="font-medium">{profile.rate_range}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Rate Cards — turns the EPK into a sales page. RateCardSection has its own
            inquiry CTA + owner-side editor so we get inquiry capture for free. */}
        <div className="mb-8">
          <RateCardSection userId={userId || ''} isOwner={isOwner} />
        </div>

        {/* Kretopia Credits — Verified Work History */}
        {credits.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Kretopia Credits
              </h3>
              <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                <Database className="h-3 w-3" />
                {credits.filter(c => c.isVerified).length} verified
              </Badge>
            </div>

            {/* Featured credits — horizontal Netflix-style scroll */}
            {credits.filter(c => c.isVerified).length > 0 && (
              <div className="mb-4">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {credits.filter(c => c.isVerified).slice(0, 8).map((credit) => {
                    const tierConfig = {
                      icdb: { label: 'Verified', className: 'bg-primary/10 text-primary border-primary/30' },
                      peer: { label: 'Peer', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
                      ai: { label: 'AI', className: 'bg-primary/10 text-primary border-primary/30' },
                      payment: { label: 'Paid', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
                      manual: { label: '', className: '' },
                    }[credit.verificationTier || 'manual'];

                    return (
                      <div key={credit.id} className="flex-shrink-0 w-[130px]">
                        <div className="rounded-xl overflow-hidden border border-primary/10 hover:border-primary/30 transition-all h-[195px] flex flex-col relative group cursor-pointer"
                          onClick={() => {
                            const name = encodeURIComponent(decodeHtmlEntities(credit.project_name || credit.title || ''));
                            navigate(`/production?name=${name}`);
                          }}
                        >
                          {/* Thumbnail or gradient fallback */}
                          {credit.thumbnail_url ? (
                            <div className="w-full h-[130px] overflow-hidden">
                              <img 
                                src={credit.thumbnail_url} 
                                alt={decodeHtmlEntities(credit.project_name || credit.title || '')}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-[130px] bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                              <CheckCircle2 className="h-8 w-8 text-primary/40" />
                            </div>
                          )}
                          <div className="p-2 flex-1 flex flex-col justify-between">
                            <p className="text-[11px] font-semibold leading-tight line-clamp-2">{decodeHtmlEntities(credit.project_name || credit.title || '')}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-[9px] text-muted-foreground truncate">{credit.role}</p>
                              {credit.year && <span className="text-[9px] text-muted-foreground">{credit.year}</span>}
                            </div>
                          </div>
                          {/* Verification badge overlay */}
                          {tierConfig.label && (
                            <Badge variant="outline" className={cn("absolute top-1.5 right-1.5 text-[7px] h-3.5 px-1 backdrop-blur-sm", tierConfig.className)}>
                              {tierConfig.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full credit list */}
            <div className="space-y-1.5">
              {credits.map((credit) => {
                const tierConfig = {
                  icdb: { label: 'Verified', className: 'bg-primary/10 text-primary border-primary/30' },
                  peer: { label: 'Peer', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
                  ai: { label: 'AI', className: 'bg-primary/10 text-primary border-primary/30' },
                  payment: { label: 'Paid', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
                  manual: { label: '', className: '' },
                }[credit.verificationTier || 'manual'];

                return (
                  <div
                    key={credit.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors",
                      credit.isVerified
                        ? "bg-primary/5 border border-primary/10"
                        : "bg-muted/50"
                    )}
                    onClick={() => {
                      const name = encodeURIComponent(decodeHtmlEntities(credit.project_name || credit.title || ''));
                      navigate(`/production?name=${name}`);
                    }}
                  >
                    {/* Thumbnail */}
                    {credit.thumbnail_url && (
                      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                        <img src={credit.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{decodeHtmlEntities(credit.project_name || credit.title || '')}</p>
                        {credit.isVerified && tierConfig.label && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", tierConfig.className)}>
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {tierConfig.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {credit.role}
                        {credit.platform && ` • ${credit.platform}`}
                      </p>
                    </div>
                    {credit.year && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{credit.year}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Industry Stats / Certifications */}
        {industryStats.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Credentials & Stats
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {industryStats.map((stat) => (
                <div
                  key={stat.id}
                  className="p-3 rounded-lg bg-muted/50 text-center"
                >
                  {stat.value && (
                    <p className="text-lg font-bold text-primary">{stat.value}</p>
                  )}
                  <p className="text-xs font-medium truncate">{stat.title}</p>
                  {stat.issuer && (
                    <p className="text-xs text-muted-foreground truncate">{stat.issuer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievement Badges */}
        {profile.achievement_badges && profile.achievement_badges.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Achievements
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.achievement_badges.slice(0, 6).map((badge: string, index: number) => (
                <Badge key={index} variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/60 text-amber-700 dark:text-amber-300 font-semibold">
                  <Award className="h-3 w-3 mr-1" />
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio section removed — credits/roll-call already surfaces the same media. */}


        {/* Media Player Modal */}
        <MediaPlayerModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem ? {
            title: selectedItem.title,
            description: selectedItem.description,
            media_type: selectedItem.media_type,
            media_url: selectedItem.media_url,
            thumbnail_url: selectedItem.thumbnail_url
          } : null}
        />

        {/* Press & Awards Combined */}
        {(pressLinks.length > 0 || awards.length > 0) && (
          <div className="mb-8 space-y-4">
            {pressLinks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Featured In
                </h3>
                <div className="space-y-2">
                  {pressLinks.slice(0, 4).map((press) => (
                    <a
                      key={press.id}
                      href={press.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      {press.image_url ? (
                        <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                          <img src={press.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{decodeHtmlEntities(press.title)}</p>
                        <p className="text-xs text-muted-foreground">{press.publication}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {awards.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Awards
                </h3>
                <div className="space-y-2">
                  {awards.slice(0, 3).map((award) => (
                    <div
                      key={award.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10"
                    >
                      <Award className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{award.title}</p>
                        <p className="text-xs text-muted-foreground">{award.organization} • {award.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews */}
        <EPKReviews
          reviews={reviews}
          averageRating={profile.average_rating}
          totalReviews={profile.total_reviews}
        />

        {/* Digital Products & Services */}
        {digitalProducts.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Products & Services
            </h3>
            <div className="grid gap-3">
              {digitalProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 p-3">
                    {product.preview_urls?.[0] && (
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                        <img 
                          src={product.preview_urls[0]} 
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {!product.preview_urls?.[0] && (
                      <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm truncate">{product.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                        </div>
                        <span className="font-bold text-primary shrink-0">${product.price}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">{product.product_type}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Download className="h-2.5 w-2.5" />
                          {product.download_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Sign up to purchase products from this creator
            </p>
          </div>
        )}

      </div>

      {/* Fixed Footer */}
      <EPKFooterCTA
        isOwner={isOwner}
        isUnclaimed={profile.is_claimed === false}
        profileName={profile.full_name}
        onClaimClick={() => setShowClaimDialog(true)}
        onShareClick={() => shareRef.current?.scrollIntoView({ behavior: 'smooth' })}
        isSignedIn={Boolean(currentUserId)}
        isConnected={connectionStatus === 'connected'}
        isPending={connectionStatus === 'pending'}
        onConnect={handleConnect}
        onMessage={() => setMessageOpen(true)}
        onCollaborate={() => setCollaborateOpen(true)}
      />
      {profile && <DirectMessageDialog open={messageOpen} onOpenChange={setMessageOpen} recipientId={profile.user_id} recipientName={profile.full_name} recipientAvatar={profile.avatar_url} />}
      {profile && connectionStatus === 'connected' && (
        <StartProjectFromMatchDialog open={collaborateOpen} onOpenChange={setCollaborateOpen} matchedUser={{ id: profile.user_id, name: profile.full_name, role: profile.role, avatar: profile.avatar_url }} />
      )}
      {profile && connectionStatus === 'connected' && (
        <InviteToProjectDialog open={inviteOpen} onOpenChange={setInviteOpen} recipientUserId={profile.user_id} recipientName={profile.full_name} />
      )}
    </div>
  );
};

export default CreatorEPK;
