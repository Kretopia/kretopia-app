import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  DollarSign, Edit, FileDown, Globe, QrCode, Share2, IdCard, Shield, Eye,
} from "lucide-react";
import { calculateProfileStrength, ProfileStrengthScore } from "@/components/profile/ProfileStrengthScore";
import { CreditScore } from "@/components/profile/CreditScore";
import { ThriveStatusCard } from "@/components/ThriveStatusCard";
import { calculateStatusFromCredits } from "@/lib/statusEngine";
import { TrustSignals } from "@/components/profile/TrustSignals";
import { CredentialVerificationCard } from "@/components/profile/CredentialVerificationCard";
import { WhoViewedProfile } from "@/components/profile/WhoViewedProfile";
import { SocialStatsSection } from "@/components/profile/SocialStatsSection";
import { DiscoveriesInbox } from "@/components/profile/DiscoveriesInbox";
import { ProfileVisibilityBanner } from "@/components/ProfileVisibilityBanner";
import { ProfileCompletionProgress } from "@/components/profile/ProfileCompletionProgress";
import { RefreshUniverseButton } from "@/components/profile/RefreshUniverseButton";
import { checkProfileCompletion, getDiscoveryMissingFields } from "@/lib/profileCompletion";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";
import { ProfileQRDialog } from "@/components/profile/ProfileQRDialog";
import { EPKPdfEditor } from "@/components/epk/EPKPdfEditor";
import { ShareableCreatorCard } from "@/components/profile/ShareableCreatorCard";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";
import { useTodayMetrics } from "./todayMetrics.selectors";
import type { ProfileRow } from "./today.types";

interface TodayMetricsDashboardProps {
  profile: ProfileRow;
  onProfileUpdate: () => void;
}

const chartConfig = {
  views: { label: "Profile views", color: "hsl(var(--primary))" },
  count: { label: "Followers", color: "hsl(var(--accent))" },
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{children}</p>
);

/**
 * TodayMetricsDashboard — the single unified dashboard that replaces the
 * old separate "Preview public Passport" / "Private dashboard" exits from
 * Passport (Profile.tsx). Everything that used to live on the standalone
 * /dashboard page (now redirected here) lives in this one surface instead,
 * so there's one clear place for "how is my Passport doing" rather than
 * two disconnected ones.
 *
 * Data split deliberately: fields already on PROFILE_SELECT (social
 * counts, verification/trust flags, credit_score) come straight from the
 * `profile` prop Today already fetches -- no second read for those. Only
 * genuinely separate tables (credits, awards, press_links, view-event
 * history) get their own read, via useTodayMetrics.
 */
export function TodayMetricsDashboard({ profile, onProfileUpdate }: TodayMetricsDashboardProps) {
  const navigate = useNavigate();
  const metrics = useTodayMetrics(profile.user_id);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isEPKOpen, setIsEPKOpen] = useState(false);
  const [isCardOpen, setIsCardOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const { score: strengthScore } = useMemo(
    () => calculateProfileStrength(profile, metrics.portfolioCount, metrics.credits.length, metrics.awardsCount, metrics.pressCount),
    [profile, metrics.portfolioCount, metrics.credits.length, metrics.awardsCount, metrics.pressCount],
  );
  const verifiedCredits = metrics.credits.filter((c) => c.verification_status === "verified").length;
  const completion = useMemo(
    () => checkProfileCompletion(profile, metrics.portfolioCount + metrics.credits.length),
    [profile, metrics.portfolioCount, metrics.credits.length],
  );
  const missingFields = useMemo(() => getDiscoveryMissingFields(profile, metrics.portfolioCount), [profile, metrics.portfolioCount]);

  const socialDistribution = useMemo(() => {
    const rows = [
      { name: "YouTube", count: profile.youtube_subscribers || 0 },
      { name: "Instagram", count: profile.instagram_followers || 0 },
      { name: "TikTok", count: profile.tiktok_followers || 0 },
      { name: "Spotify", count: profile.spotify_listeners || 0 },
      { name: "Twitter", count: profile.twitter_followers || 0 },
      { name: "LinkedIn", count: profile.linkedin_connections || 0 },
    ];
    return rows.filter((r) => r.count > 0);
  }, [profile]);

  const tools: { label: string; icon: typeof Edit; onClick: () => void; hint?: string }[] = [
    { label: "Edit Passport", icon: Edit, onClick: () => setIsEditOpen(true), hint: "Update your details" },
    { label: "QR Code", icon: QrCode, onClick: () => setIsQROpen(true), hint: "Scan to view passport" },
    { label: "Share Passport", icon: IdCard, onClick: () => setIsShareOpen(true), hint: "Copy & share link" },
    { label: "Share Card", icon: Share2, onClick: () => setIsCardOpen(true), hint: "Shareable creator card" },
    { label: "EPK Export", icon: FileDown, onClick: () => setIsEPKOpen(true), hint: "Generate press kit PDF" },
    ...(profile.site_enabled
      ? [{ label: "My Website", icon: Globe, onClick: () => navigate("/website-builder"), hint: profile.username ? `kretopia.com/${profile.username}` : "Open builder" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* AT A GLANCE — the three numbers that matter, always visible; no
          chart junk, no decoration competing with the numbers themselves. */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{strengthScore}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Profile strength</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{profile.verification_score ?? 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Trust score</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{metrics.totalViews14d}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Views, 14d</p>
        </Card>
      </div>

      {/* ACTIVITY — real per-day view counts from analytics_events, zero-
          filled so quiet days show as a flat line, not a gap. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            Passport views, last 14 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.loading ? (
            <div className="h-[160px] animate-pulse rounded-lg bg-muted/40" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <AreaChart data={metrics.viewTrend} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval={2} />
                <YAxis className="text-xs" tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="views" stroke="var(--color-views)" fill="var(--color-views)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* DISTRIBUTION — only rendered once there's real follower data on
          at least one platform; an all-zero chart is chart junk, not signal. */}
      {socialDistribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Audience by platform</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <BarChart data={socialDistribution} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tick={{ fontSize: 10 }} allowDecimals={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* PROFILE HEALTH -- ported from the old /dashboard page verbatim;
          hidden once there's nothing left to act on so a fully-complete
          profile doesn't keep seeing an empty progress bar. */}
      {(missingFields.length > 0 || completion.percentage < 100 || strengthScore < 100) && (
        <section className="space-y-2">
          <SectionLabel>Profile health</SectionLabel>
          <ProfileVisibilityBanner isVisible={missingFields.length === 0} missingFields={missingFields} />
          {completion.percentage < 100 && <ProfileCompletionProgress completion={completion} />}
          {strengthScore < 100 && (
            <ProfileStrengthScore
              profile={profile}
              portfolioCount={metrics.portfolioCount}
              creditsCount={metrics.credits.length}
              awardsCount={metrics.awardsCount}
              pressCount={metrics.pressCount}
            />
          )}
          <RefreshUniverseButton lastScanAt={profile.last_universe_scan_at} />
        </section>
      )}

      {/* STANDING */}
      <section className="space-y-2">
        <SectionLabel>Standing</SectionLabel>
        <ThriveStatusCard status={calculateStatusFromCredits(metrics.credits)} />
        {(metrics.credits.length > 0 || metrics.awardsCount > 0) && (
          <CreditScore
            totalCredits={metrics.credits.length}
            verifiedCredits={verifiedCredits}
            awardsCount={metrics.awardsCount}
            portfolioCount={metrics.portfolioCount}
          />
        )}
      </section>

      {/* TRUST & VERIFICATION */}
      <section className="space-y-3">
        <SectionLabel>Trust & verification</SectionLabel>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Verification signals</h3>
          </div>
          <TrustSignals
            emailVerified={profile.email_verified}
            phoneVerified={profile.phone_verified}
            idVerified={profile.id_verified}
            paymentVerified={profile.payment_verified}
            isOwnProfile
          />
        </Card>
        <CredentialVerificationCard
          userId={profile.user_id}
          fullName={profile.full_name}
          role={profile.role || ""}
          bio={profile.bio || ""}
          socialLinks={{
            spotify: profile.spotify_url || "",
            youtube: profile.youtube_url || "",
            imdb: profile.imdb_url || "",
            instagram: profile.instagram_url || "",
            linkedin: profile.linkedin_url || "",
          }}
          currentTier={profile.verification_tier || undefined}
          currentAchievements={profile.achievement_badges || []}
          verifiedCredentials={(profile as any).verified_credentials || []}
          verificationScore={profile.verification_score || undefined}
          verifiedAt={profile.verified_at || undefined}
          breakdown={(profile as any).verification_breakdown || undefined}
          onVerificationComplete={onProfileUpdate}
        />
      </section>

      {/* AUDIENCE */}
      <section className="space-y-3">
        <SectionLabel>Audience</SectionLabel>
        <WhoViewedProfile userId={profile.user_id} isPro={["pro", "creator_pro", "founder"].includes(profile.subscription_tier || "")} />
        <SocialStatsSection
          youtubeSubscribers={profile.youtube_subscribers}
          instagramFollowers={profile.instagram_followers}
          tiktokFollowers={profile.tiktok_followers}
          spotifyListeners={profile.spotify_listeners}
          twitterFollowers={profile.twitter_followers}
          linkedinConnections={profile.linkedin_connections}
          youtubeUrl={profile.youtube_url}
          instagramUrl={profile.instagram_url}
          tiktokUrl={profile.tiktok_url}
          spotifyUrl={profile.spotify_url}
          twitterUrl={profile.twitter_url}
          linkedinUrl={profile.linkedin_url}
          verifiedMetrics={profile.social_verified}
          isOwner
          onRefreshed={onProfileUpdate}
        />
      </section>

      {/* ACTIONS — Money + Discoveries + the Edit/QR/Share tools that used
          to live only on the old standalone /dashboard page. Batch 5 moves
          Edit/QR/Share onto Passport itself; kept fully working here in
          the meantime so nothing regresses before that lands. */}
      <section className="space-y-2">
        <SectionLabel>Actions</SectionLabel>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => navigate("/thrivepay")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate("/thrivepay")}
          className="group p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">KrePay</p>
              <p className="text-xs text-muted-foreground mt-0.5">Invoices, wallet, earnings & receipts</p>
            </div>
          </div>
        </Card>
        <DiscoveriesInbox userId={profile.user_id} onApproved={onProfileUpdate} />
        <div className="grid grid-cols-2 gap-2">
          {tools.map(({ label, icon: Icon, onClick, hint }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="btn-glass btn-glass-outline group flex items-start gap-2.5 rounded-xl p-3 text-left"
            >
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[hsl(var(--energy))] mt-0.5 shrink-0 transition-colors" />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{label}</p>
                {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Dialogs */}
      <ProfileEditDialog open={isEditOpen} onOpenChange={setIsEditOpen} profile={profile} onProfileUpdate={onProfileUpdate} />
      <ProfileQRDialog open={isQROpen} onOpenChange={setIsQROpen} userId={profile.user_id} userName={profile.full_name || ""} userAvatar={profile.avatar_url || undefined} />
      <ShareableCreatorCard
        open={isCardOpen}
        onOpenChange={setIsCardOpen}
        profile={{
          full_name: profile.full_name || "",
          role: profile.role || "",
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          badge: profile.badge,
          level: profile.level,
          xp: profile.xp,
          location: profile.location,
          professional_skills: profile.professional_skills as Array<{ skill: string }> | null,
        }}
      />
      <ShareProfileDialog
        profile={{
          full_name: profile.full_name || "",
          role: profile.role || "",
          bio: profile.bio || "",
          user_id: profile.user_id,
          avatar_url: profile.avatar_url || "",
          verification_tier: profile.verification_tier || undefined,
          professional_skills: Array.isArray(profile.professional_skills) ? (profile.professional_skills as string[]) : [],
          location: profile.location || "",
        }}
        portfolioItems={[]}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
      {isEPKOpen && (
        <EPKPdfEditor
          open={isEPKOpen}
          onClose={() => setIsEPKOpen(false)}
          userId={profile.user_id}
          epkData={{
            profile: {
              full_name: profile.full_name,
              role: profile.role,
              job_title: profile.job_title,
              bio: profile.bio,
              location: profile.location,
              avatar_url: profile.avatar_url,
              website: profile.website,
              calendly_url: profile.calendly_url,
              linkedin_url: profile.linkedin_url,
              instagram_url: profile.instagram_url,
              twitter_url: profile.twitter_url,
              youtube_url: profile.youtube_url,
              spotify_url: profile.spotify_url,
              behance_url: profile.behance_url,
              imdb_url: profile.imdb_url,
              soundcloud_url: profile.soundcloud_url,
              average_rating: profile.average_rating,
              total_reviews: profile.total_reviews,
              professional_skills: profile.professional_skills,
              passion_skills: profile.passion_skills,
              collab_intent: profile.collab_intent,
              rate_range: profile.rate_range,
              cover_image_url: profile.cover_image_url,
              verification_tier: profile.verification_tier,
              verification_status: profile.verification_status,
            },
            credits: [],
            awards: [],
            pressLinks: [],
            industryStats: [],
            reviews: [],
          }}
        />
      )}
    </div>
  );
}

export default TodayMetricsDashboard;
