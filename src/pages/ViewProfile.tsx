import { useEffect, useState } from "react";
import { notifyUser } from "@/lib/notifyUser";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { maskCreatorName } from "@/lib/guestUtils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FramedAvatar } from "@/components/ui/framed-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  MapPin, 
  ArrowLeft, 
  MessageCircle, 
  Briefcase,
  Sparkles,
  Star,
  Award,
  Rocket,
  UserPlus,
  Clock,
  Users,
  UserCheck,
  Share2,
  Handshake,
  Video
} from "lucide-react";
import { useStartDirectCall } from "@/hooks/useStartDirectCall";
import { VideoCallSheet } from "@/components/project/VideoCallSheet";
import { ClaimProfileDialog } from "@/components/profile/ClaimProfileDialog";
import { ShareUnclaimedProfileDialog } from "@/components/profile/ShareUnclaimedProfileDialog";
import { DirectMessageDialog } from "@/components/DirectMessageDialog";
import { StartProjectFromMatchDialog } from "@/components/project/StartProjectFromMatchDialog";
import { InviteToProjectDialog } from "@/components/project/InviteToProjectDialog";
import { FolderPlus } from "lucide-react";
import { MediaPlayerModal } from "@/components/profile/MediaPlayerModal";
import { SEO } from "@/components/SEO";
import CreatorEPK from "./CreatorEPK";
import { DegreeBadge } from "@/components/circle/DegreeBadge";
import { useConnectionDegree } from "@/hooks/useNetworkStats";
import { calculateStatusFromCredits } from "@/lib/statusEngine";
import { checkConnectionGate, type GateCheckResult } from "@/lib/connectionGate";
import { StatusBadge } from "@/components/StatusBadge";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import { APP_URL } from "@/lib/constants";
import { ConnectionGateBanner } from "@/components/ConnectionGateBanner";

// Import profile section components
import { SkillsSection } from "@/components/profile/SkillsSection";
import { SocialStatsSection } from "@/components/profile/SocialStatsSection";
import { ICDBTimeline } from "@/components/profile/ICDBTimeline";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { ProfileRatingSummary } from "@/components/profile/ProfileRatingSummary";
import { VideoIntroSection } from "@/components/profile/VideoIntroSection";
import { ServicePackagesSection } from "@/components/profile/ServicePackagesSection";
import { AvailabilityIndicator } from "@/components/profile/AvailabilityIndicator";
import { ViewProfileTabs } from "@/components/profile/ViewProfileTabs";
import { RecentlyWorkedWith } from "@/components/passport/RecentlyWorkedWith";
import { HireMeTrustBar } from "@/components/passport/HireMeTrustBar";
import { PassportMomentum } from "@/components/passport/PassportMomentum";
import { BookedThisMonthChip } from "@/components/passport/BookedThisMonthChip";
import { ReplySLABadge } from "@/components/passport/ReplySLABadge";

interface Profile {
  user_id: string;
  full_name: string;
  role: string;
  bio: string;
  location: string;
  avatar_url: string;
  account_type?: string;
  company_name?: string;
  company_industry?: string;
  company_logo_url?: string;
  verification_tier?: string;
  verification_status?: string;
  achievement_badges?: string[];
  professional_skills?: any;
  passion_skills?: any;
  collab_intent?: string;
  rate_range?: string;
  average_rating?: number;
  total_reviews?: number;
  youtube_subscribers?: number;
  instagram_followers?: number;
  tiktok_followers?: number;
  spotify_listeners?: number;
  twitter_followers?: number;
  linkedin_connections?: number;
  social_verified?: boolean;
  job_title?: string;
  industry?: string;
  is_claimed?: boolean;
  badge?: string;
  profile_frame?: string | null;
  hourly_rate?: number;
  project_rate?: number;
  rate_currency?: string;
  avg_response_hours?: number;
}

const ViewProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatched, setIsMatched] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isStartProjectOpen, setIsStartProjectOpen] = useState(false);
  const [isInviteToProjectOpen, setIsInviteToProjectOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [showClaimDialog, setShowClaimDialog] = useState(searchParams.get('showClaim') === 'true');
  const [showShareToChat, setShowShareToChat] = useState(false);
  const [gateResult, setGateResult] = useState<GateCheckResult | null>(null);

  // 1:1 video call from profile (connected/matched users only)
  const directCall = useStartDirectCall();
  const startCall = () => {
    if (!profile?.user_id) return;
    void directCall.start(profile.user_id, profile.full_name || "there", { context: "profile-call" });
  };

  const isFromMatch = searchParams.get('from') === 'match';
  
  // Get connection degree info
  const { degree, path: connectionPath } = useConnectionDegree(user?.id, userId);

  // If viewing own profile, redirect to /profile
  useEffect(() => {
    if (user && userId === user.id) {
      navigate('/profile', { replace: true });
    }
  }, [user, userId, navigate]);

  // This page's own data fetch requires an authenticated session (below),
  // so an anonymous visitor -- including every search-engine crawler and
  // link-preview bot -- always hit a bare "Profile not found" wall here,
  // no matter whose real profile the link pointed at. /epk/:userId is the
  // actual public equivalent (full Person JSON-LD, canonical, OG image
  // already correct there) -- send anonymous visitors there instead of
  // guessing at fixing this page's own auth gate.
  useEffect(() => {
    if (!authLoading && !user && userId) {
      navigate(`/epk/${userId}`, { replace: true });
    }
  }, [authLoading, user, userId, navigate]);

  // Auth gate moved below all hooks to avoid React hooks violation

  const fetchData = async () => {
    if (!userId || !user) return;
    
    setIsLoading(true);
    try {
      // Fetch profile — this branch only ever runs for someone OTHER than
      // the profile owner (the effect above redirects an owner viewing
      // their own userId to /profile before we get here). RLS on the base
      // `profiles` table is owner-only as of migration 20260502224404, so
      // a raw `.from('profiles')` read here always came back empty for
      // every other logged-in viewer — the exact bug this fixes.
      // public_profiles_safe is the existing, already-granted-to-anon/
      // authenticated safe path (same one CreatorEPK, HandleResolver, and
      // Circle's Browse tab already use). Its column list is a subset of
      // PROFILE_SELECT — see CreatorEPK's field-gap note in
      // PASSPORT_AND_CONVERSION_AUDIT.md for what's temporarily absent
      // (company_name/company_industry/company_logo_url, achievement_badges,
      // collab_intent, rate_range, average_rating, total_reviews, is_claimed,
      // hourly_rate/project_rate/rate_currency, avg_response_hours,
      // availability_status/note, social follower counts, social_verified,
      // job_title, industry, profile_frame, email_verified/phone_verified/
      // payment_verified, video_intro_url) until a follow-up migration
      // extends the view. Every downstream usage of these fields already
      // handles undefined gracefully (optional chaining / conditional
      // rendering), confirmed by reading this file fully before making
      // this change.
      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles_safe')
        .select('user_id, full_name, role, bio, location, avatar_url, account_type, verification_tier, verification_status, professional_skills, badge, id_verified')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) return;
      // Company accounts store their identity under company_name/
      // company_industry/company_logo_url rather than full_name/role/
      // avatar_url. Those columns aren't in public_profiles_safe (see the
      // field-gap note above), so the company_name → full_name normalization
      // this page previously did for non-owner viewers can't happen here
      // anymore — a company's `full_name`/`role`/`avatar_url` columns are
      // used as-is instead, same as any individual account, until a
      // follow-up migration exposes the company_* columns through the
      // safe view too.
      setProfile(profileData);

      // Fetch portfolio items (credits with source=portfolio)
      const { data: portfolioData } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .eq('source', 'portfolio')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      setPortfolioItems(portfolioData || []);

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*')
        .eq('profile_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (reviewsData) {
        // Fetch reviewer profiles — same non-owner-read issue as above,
        // reviewers are essentially always someone other than the current
        // viewer, so this also needs the safe view rather than the raw table.
        const reviewerIds = reviewsData.map(r => r.reviewer_id);
        const { data: reviewerProfiles } = await supabase
          .from('public_profiles_safe')
          .select('user_id, full_name, avatar_url, role')
          .in('user_id', reviewerIds);

        const reviewsWithProfiles = reviewsData.map(review => ({
          ...review,
          reviewer: reviewerProfiles?.find(p => p.user_id === review.reviewer_id)
        }));
        setReviews(reviewsWithProfiles);
      }

      // Fetch credits and awards for Industry Verified badge
      const [creditsResult, awardsResult] = await Promise.all([
        supabase.from('credits').select('id').eq('user_id', userId),
        supabase.from('awards').select('id').eq('user_id', userId)
      ]);
      
      setCredits(creditsResult.data || []);
      setAwards(awardsResult.data || []);

      // Check if matched
      const { data: matchData } = await supabase
        .from('matches')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .eq('status', 'active')
        .limit(1);

      setIsMatched(matchData && matchData.length > 0);
      if (matchData && matchData.length > 0) {
        setMatchId(matchData[0].id);
      }
      
      // Check connection status
      const { data: connectionData } = await supabase
        .from('connections')
        .select('status')
        .or(`and(user_id.eq.${user.id},connected_user_id.eq.${userId}),and(user_id.eq.${userId},connected_user_id.eq.${user.id})`)
        .limit(1);
      
      if (connectionData && connectionData.length > 0) {
        setConnectionStatus(connectionData[0].status === 'accepted' ? 'connected' : 'pending');
      } else {
        setConnectionStatus('none');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Track profile view
    if (userId && user && userId !== user.id) {
      import('@/lib/profileViewTracking').then(({ trackProfileView }) => {
        trackProfileView(userId, isFromMatch ? 'match' : 'public');
      });

      // Check connection gate
      checkConnectionGate(user.id, userId).then(setGateResult);
    }
  }, [userId, user]);
  
  // Handle connection request
  const handleConnect = async () => {
    if (!user || !userId) return;
    
    setIsConnecting(true);
    try {
      const isGated = gateResult?.gate === 'request_only';
      
      // Insert connection request — mark as filtered if gated
      const { error } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status: 'pending',
          is_message_request: isGated,
        });
      
      if (error) {
        if (error.code === '23505') {
          toast.info('Connection request already sent');
        } else {
          throw error;
        }
      } else {
        setConnectionStatus('pending');
        if (isGated) {
          toast.success(`Request sent — it will appear in ${profile?.full_name}'s filtered inbox`);
        } else {
          toast.success(`Connection request sent to ${profile?.full_name}`);
        }
        
        // Create notification for the other user
        await notifyUser({
          userId,
          title: isGated ? 'Filtered Connection Request' : 'New Connection Request',
          message: `${user.user_metadata?.full_name || 'Someone'} wants to connect with you`,
          type: 'connection',
          link: `/profile/${user.id}`,
          actionUrl: `/profile/${user.id}`,
          actionText: 'View Profile',
        });
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast.error('Failed to send connection request');
    } finally {
      setIsConnecting(false);
    }
  };

  // Check if this is an unclaimed profile
  const isUnclaimedProfile = profile?.is_claimed === false;
  
  // Check if profile qualifies for Industry Verified badge (3+ credits OR 2+ awards)
  const isIndustryVerified = credits.length >= 3 || awards.length >= 2 || profile?.verification_tier === 'industry';
  
  const getVerificationBadge = () => {
    if (!profile?.verification_status || profile.verification_status !== 'verified') return null;
    
    return (
      <Badge className="gap-1.5 gradient-primary text-primary-foreground border-0 shadow-lg shadow-primary/25">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3"
        >
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        <span className="text-xs font-bold tracking-wide">VERIFIED</span>
      </Badge>
    );
  };

  // If not authenticated, show public EPK
  if (!authLoading && !user) {
    return <CreatorEPK />;
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-10 w-24 mb-6" />
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profile not found</h2>
          <Button onClick={() => navigate('/circle')}>Go to Circle</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`${profile.full_name} | Kretopia`}
        description={profile.bio || `Check out ${profile.full_name}'s profile on Kretopia`}
      />
      
      <div className="min-h-screen bg-background pb-24 lg:pb-6">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => {
              // If we have history, go back; otherwise go to Circle
              if (window.history.length > 2) {
                navigate(-1);
              } else {
                navigate('/circle');
              }
            }}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Match Celebration Banner */}
          {(isMatched || isFromMatch) && (
            <Card className="mb-6 bg-gradient-to-r from-primary/10 via-primary/10 to-primary/10 border-primary/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">You're matched!</p>
                    <p className="text-sm text-muted-foreground">Start a conversation or collaborate on a project</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Header Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              {/* Unclaimed Profile Banner */}
              {isUnclaimedProfile && (
                <div className="mb-6 p-3 rounded-xl bg-scout/10 border border-scout/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-scout">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium">Unclaimed Profile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowShareDialog(true)}
                        className="gap-1.5 h-8 border-scout/30 text-scout hover:bg-scout/10"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setShowClaimDialog(true)}
                        className="gap-1.5 h-8 gradient-primary text-primary-foreground border-0"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Claim
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Is this you? Verify your identity to claim this profile and unlock all features.
                  </p>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar with Frame */}
                <FramedAvatar
                  src={profile.avatar_url}
                  fallback={profile.full_name?.charAt(0) || 'U'}
                  alt={profile.full_name || undefined}
                  frame={profile.profile_frame}
                  className="h-24 w-24 border-4 border-background shadow-lg"
                />

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{maskCreatorName(profile.full_name, !!user)}</h1>
                    {getVerificationBadge()}
                    
                    {/* ThriveStatus Badge */}
                    {credits.length > 0 && (
                      <StatusBadge 
                        status={calculateStatusFromCredits(credits)} 
                        showSocialProof
                      />
                    )}
                    
                    {/* Industry Verified Badge */}
                    {isIndustryVerified && (
                      <Badge className="gap-1.5 bg-accent text-accent-foreground border-0">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-xs font-semibold">Industry Verified</span>
                      </Badge>
                    )}
                    
                    {/* Unclaimed Badge - only show if NOT industry verified (avoid badge clutter) */}
                    {isUnclaimedProfile && !isIndustryVerified && (
                      <Badge 
                        variant="secondary"
                        className="text-xs bg-amber-500/20 text-amber-500 border-amber-500/30"
                      >
                        Unclaimed
                      </Badge>
                    )}
                    
                    {/* OG/Beta/ODOS Badge - only for claimed profiles */}
                    {profile.badge && (
                      <Badge 
                        variant="default"
                        className={profile.badge === 'odos' ? "bg-green-500 hover:bg-green-600" : ""}
                      >
                        {profile.badge === 'founder' ? '👑 Founder' : 
                         profile.badge === 'og' ? 'OG' : 
                         profile.badge === 'odos' ? '🌿 ODOS' :
                         profile.badge === 'official' ? '✓ Official' : 'Beta'}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-muted-foreground mb-2">{profile.role}</p>
                  
                  {profile.location && (
                    <div className="flex items-center justify-center sm:justify-start gap-1 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4" />
                      {profile.location}
                    </div>
                  )}

                  {/* Availability Status */}
                  <div className="flex justify-center sm:justify-start mb-3">
                    <AvailabilityIndicator
                      status={(profile as any).availability_status}
                      note={(profile as any).availability_note}
                      isOwnProfile={false}
                    />
                  </div>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
                    {profile.collab_intent && (
                      <Badge variant="secondary" className="gap-1">
                        <Briefcase className="h-3 w-3" />
                        {profile.collab_intent}
                      </Badge>
                    )}
                    {profile.hourly_rate && (
                      <Badge variant="outline" className="gap-1">
                        ${profile.hourly_rate}/{profile.rate_currency || 'USD'}/hr
                      </Badge>
                    )}
                    {profile.project_rate && (
                      <Badge variant="outline" className="gap-1">
                        ${profile.project_rate}/{profile.rate_currency || 'USD'}/project
                      </Badge>
                    )}
                    {!profile.hourly_rate && !profile.project_rate && profile.rate_range && (
                      <Badge variant="outline">{profile.rate_range}</Badge>
                    )}
                    {profile.avg_response_hours && profile.avg_response_hours > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        ~{profile.avg_response_hours < 1 ? '<1' : Math.round(profile.avg_response_hours)}hr response
                      </Badge>
                    )}
                  </div>

                  {/* Achievement Badges */}
                  {profile.achievement_badges && profile.achievement_badges.length > 0 && (
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
                      {profile.achievement_badges.slice(0, 3).map((badge, i) => (
                        <Badge key={i} className="bg-accent text-accent-foreground gap-1">
                          <Award className="h-3 w-3" />
                          {badge}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Bio */}
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>
                  )}

                  {/* Rating Summary */}
                  {((profile.average_rating && profile.average_rating > 0) || (profile.total_reviews && profile.total_reviews > 0)) && (
                    <ProfileRatingSummary
                      averageRating={profile.average_rating || 0}
                      totalReviews={profile.total_reviews || 0}
                      className="mt-3"
                    />
                  )}

                  {/* Compact Trust Signals */}
                  <div className="mt-3">
                    <TrustSignals
                      emailVerified={(profile as any).email_verified}
                      phoneVerified={(profile as any).phone_verified}
                      idVerified={(profile as any).id_verified}
                      paymentVerified={(profile as any).payment_verified}
                      isOwnProfile={false}
                      compact
                    />
                  </div>
                </div>
              </div>

              {/* Connection Degree Badge */}
              {degree !== null && degree > 0 && degree <= 3 && (
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
                  <DegreeBadge degree={degree as 1 | 2 | 3} showLabel />
                  {connectionPath.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      via {connectionPath.map(c => c.fullName).join(' → ')}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-6 pt-6 border-t">
                {!user ? (
                  <Button onClick={() => navigate('/auth')} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Sign Up to Connect
                  </Button>
                ) : isUnclaimedProfile ? (
                  <Button variant="outline" onClick={() => navigate('/circle')} className="gap-2">
                    <Users className="h-4 w-4" />
                    Discover More
                  </Button>
                ) : isMatched ? (
                  <>
                    <Button onClick={() => setIsMessageDialogOpen(true)} className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      onClick={startCall}
                      disabled={directCall.starting}
                      className="gap-2"
                      aria-label={`Video call ${profile?.full_name ?? "creator"}`}
                    >
                      <Video className="h-4 w-4" />
                      Call
                    </Button>
                    <Button variant="outline" onClick={() => setIsStartProjectOpen(true)} className="gap-2">
                      <Rocket className="h-4 w-4" />
                      Start Project
                    </Button>
                    <Button variant="outline" onClick={() => setIsInviteToProjectOpen(true)} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Add to Project
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setShowShareToChat(true)} aria-label="Share profile">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : connectionStatus === 'connected' ? (
                  <>
                    <Button onClick={() => setIsMessageDialogOpen(true)} className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      onClick={startCall}
                      disabled={directCall.starting}
                      className="gap-2"
                      aria-label={`Video call ${profile?.full_name ?? "creator"}`}
                    >
                      <Video className="h-4 w-4" />
                      Call
                    </Button>
                    <Button variant="outline" onClick={() => setIsStartProjectOpen(true)} className="gap-2">
                      <Rocket className="h-4 w-4" />
                      Collaborate
                    </Button>
                    <Button variant="outline" onClick={() => setIsInviteToProjectOpen(true)} className="gap-2">
                      <FolderPlus className="h-4 w-4" />
                      Add to Project
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setShowShareToChat(true)} aria-label="Share profile">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : connectionStatus === 'pending' ? (
                  <Button variant="outline" disabled className="gap-2">
                    <Clock className="h-4 w-4" />
                    Request Pending
                  </Button>
                ) : (
                  <>
                    {gateResult?.gate === 'request_only' && (
                      <ConnectionGateBanner
                        gate={gateResult.gate}
                        message={gateResult.message}
                        recipientName={profile?.full_name}
                        className="w-full"
                      />
                    )}
                    <Button 
                      onClick={handleConnect} 
                      disabled={isConnecting}
                      className="gap-2"
                      variant={gateResult?.gate === 'request_only' ? 'outline' : 'default'}
                    >
                      <UserPlus className="h-4 w-4" />
                      {isConnecting ? 'Sending...' : gateResult?.gate === 'request_only' ? 'Send Request' : 'Connect'}
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/circle')} className="gap-2">
                      <Users className="h-4 w-4" />
                      Discover More
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Claim Profile Dialog */}
          <ClaimProfileDialog
            open={showClaimDialog}
            onOpenChange={setShowClaimDialog}
            profile={profile}
            onSuccess={() => {
              setShowClaimDialog(false);
              fetchData();
            }}
          />

          {/* Share Unclaimed Profile Dialog */}
          {isUnclaimedProfile && (
            <ShareUnclaimedProfileDialog
              open={showShareDialog}
              onOpenChange={setShowShareDialog}
              profileName={profile.full_name}
              profileUrl={`${APP_URL}/profile/${profile.user_id}`}
            />
          )}

          {/* Video Intro */}
          <VideoIntroSection
            videoUrl={(profile as any).video_intro_url}
            isOwnProfile={false}
            onRefresh={fetchData}
          />

          {/* Service Packages */}
          <ServicePackagesSection userId={profile.user_id} isOwnProfile={false} />

          {/* Hire-Me trust bar — response time, rate confidence, booking availability */}
          <HireMeTrustBar
            userId={profile.user_id}
            avgResponseHours={profile.avg_response_hours as any}
            hourlyRate={profile.hourly_rate}
            projectRate={profile.project_rate}
            rateCurrency={profile.rate_currency}
            collabIntent={profile.collab_intent}
            className="my-4"
          />

          {/* Live proof chips — booked this month + reply SLA */}
          <div className="flex flex-wrap items-center gap-2 my-3">
            <BookedThisMonthChip userId={profile.user_id} variant="light" />
            <ReplySLABadge userId={profile.user_id} fallbackHours={profile.avg_response_hours as any} variant="light" />
          </div>

          {/* Recently worked with — IMDb-style collaborator strip */}
          <RecentlyWorkedWith userId={profile.user_id} className="my-4" />

          {/* Last-30-day momentum — proves this Passport is alive */}
          <PassportMomentum userId={profile.user_id} />





          {/* Tabbed Content Sections */}
          <ViewProfileTabs
            profile={profile}
            portfolioItems={portfolioItems}
            reviews={reviews}
            credits={credits}
            awards={awards}
            userId={profile.user_id}
            isMatched={isMatched}
            connectionStatus={connectionStatus}
            onRefresh={fetchData}
          />
        </div>
      </div>

      {/* Message Dialog */}
      <DirectMessageDialog
        open={isMessageDialogOpen}
        onOpenChange={setIsMessageDialogOpen}
        recipientId={profile.user_id}
        recipientName={profile.full_name}
        recipientAvatar={profile.avatar_url}
      />

      {/* Start Project Dialog - works for matched or connected users */}
      {(isMatched || connectionStatus === 'connected') && (
        <StartProjectFromMatchDialog
          open={isStartProjectOpen}
          onOpenChange={setIsStartProjectOpen}
          matchedUser={{
            id: profile.user_id,
            name: profile.full_name,
            role: profile.role,
            avatar: profile.avatar_url
          }}
          matchId={matchId || undefined}
        />
      )}

      {/* Add to existing project dialog */}
      {(isMatched || connectionStatus === 'connected') && profile?.user_id && (
        <InviteToProjectDialog
          open={isInviteToProjectOpen}
          onOpenChange={setIsInviteToProjectOpen}
          recipientUserId={profile.user_id}
          recipientName={profile.full_name || 'this user'}
        />
      )}

      {/* Media Player Modal */}
      {selectedMedia && (
        <MediaPlayerModal
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
          item={selectedMedia}
        />
      )}

      {/* Claim Profile Dialog */}
      {isUnclaimedProfile && (
        <ClaimProfileDialog
          open={showClaimDialog}
          onOpenChange={setShowClaimDialog}
          profile={profile}
          onSuccess={() => navigate('/onboarding')}
        />
      )}

      {/* Share Unclaimed Profile Dialog */}
      {isUnclaimedProfile && (
        <ShareUnclaimedProfileDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          profileName={profile.full_name}
            profileUrl={`${APP_URL}/profile/${profile.user_id}`}
        />
      )}

      <ShareToMessageDialog
        open={showShareToChat}
        onOpenChange={setShowShareToChat}
        contentType="profile"
        contentId={profile.user_id}
        contentMeta={{
          title: profile.full_name,
          subtitle: profile.role || undefined,
          image_url: profile.avatar_url,
        }}
        externalUrl={`${APP_URL}/profile/${profile.user_id}`}
        externalText={`Check out ${profile.full_name} on Kretopia — ${APP_URL}/profile/${profile.user_id}`}
      />

      {directCall.session && (
        <VideoCallSheet
          open={directCall.open}
          onOpenChange={directCall.setOpen}
          projectName={`Call with ${profile?.full_name ?? "creator"}`}
          roomUrl={directCall.session.roomUrl}
          token={directCall.session.token}
          callId={directCall.session.callId}
          userName={directCall.myName}
          directCallId={directCall.session.callId}
          roomName={directCall.session.roomName}
        />
      )}
    </>
  );
};

export default ViewProfile;
