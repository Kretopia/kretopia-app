import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Copy, CheckCircle2, QrCode, Link2, TrendingUp, Users, Zap, ArrowRight, Share2, Gift } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useReferralNetwork } from "@/hooks/useReferralNetwork";
import { getAllNetworkTiers, getReferralsToNextTier, getProRewardText } from "@/lib/referralEngine";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { StudioFeatureShell } from "@/components/studio-reference/StudioFeatureShell";
import { HoloCard } from "@/components/passport/HoloCard";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";

const CREATIVE_CIRCLE_TUTORIAL: TutorialStep[] = [
  { icon: Users, title: "Invite creatives", body: "Using your personal link, QR code, or direct share." },
  { icon: TrendingUp, title: "Level up your tier", body: "As more people join through you — unlock free Pro, reduced fees, and status points." },
  { icon: Gift, title: "Earn passive commission", body: "From Kretopia's service fee when your referrals complete paid gigs — they keep 100% of their earnings." },
];

/**
 * One circular medallion, reused for the current-tier hero (large) and
 * every row in the Tier Rewards list (small) -- a single visual language
 * for "this is a tier badge" instead of a plain icon-plus-label row, and
 * one place to keep it consistent rather than two hand-built treatments.
 */
const TierMedallion = ({
  tier,
  size = "md",
  active = true,
}: {
  tier: ReturnType<typeof getAllNetworkTiers>[number];
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) => {
  const dims = size === "lg" ? "h-16 w-16" : size === "md" ? "h-11 w-11" : "h-9 w-9";
  const iconDims = size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full flex items-center justify-center border bg-gradient-to-br",
        dims,
        active ? tier.gradient : "from-muted/30 to-muted/5",
        active ? tier.ringClass.replace("ring-", "border-") : "border-border",
      )}
    >
      <tier.icon className={cn(iconDims, active ? tier.color : "text-muted-foreground")} aria-hidden />
    </div>
  );
};

const CreativeCircle = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const network = useReferralNetwork();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [personalLink, setPersonalLink] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("invites")
      .select("invite_code")
      .eq("inviter_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setPersonalLink(`https://www.kretopia.com/join/${data[0].invite_code}`);
        }
      }, () => {});
  }, [user]);

  const copyLink = async () => {
    if (!personalLink) return;
    const msg = `Stop cold DMing strangers for collabs.\n\nKretopia matches you with verified creatives who fit your style — portfolio-first, credits-verified.\n\nI'm already on. Join me:\n${personalLink}`;
    await navigator.clipboard.writeText(msg);
    setCopied(true);
    toast({ title: "Copied!", description: "Your invite link is ready to share" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (!personalLink) return;
    if (navigator.share) {
      await navigator.share({
        title: "Join Kretopia",
        text: "Kretopia matches you with verified creatives who fit your style. Join me:",
        url: personalLink,
      });
    } else {
      copyLink();
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const nextTierInfo = getReferralsToNextTier(network.referralCount);
  const allTiers = getAllNetworkTiers().filter(t => t.tier !== "none");

  const progressPercent = nextTierInfo
    ? Math.min(100, ((network.referralCount - network.tier.minReferrals) / (nextTierInfo.next.minReferrals - network.tier.minReferrals)) * 100)
    : 100;

  return (
    <div>
      <SEO title="Creative Circle | Kretopia" description="Grow your creative network, unlock rewards, and earn passive income by inviting creatives to Kretopia." />

      <FeaturePageHeader
        eyebrow="Creative Circle"
        title="Creative Circle."
        accentTitle="Earn as it grows."
        subtitle="Invite creatives, climb tiers, and earn passive commission — all from one link."
        tutorial={{ featureKey: "creative-circle", label: "How Creative Circle works", steps: CREATIVE_CIRCLE_TUTORIAL }}
      />

      <StudioFeatureShell>

      {/* Hero — Current Tier, as a real Passport-grade identity surface
          (same HoloCard treatment as the owner Passport / Today's mini
          Passport / New Room's celebration) instead of a plain
          gradient div -- this is Kretopia's one dominant status badge
          for the feature, so it gets the one dominant status treatment. */}
      <HoloCard maxTilt={6}>
        <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card p-5", network.tier.tier !== "none" && "shadow-glow")}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: `radial-gradient(60% 55% at 85% 0%, hsl(var(--energy) / 0.14), transparent 65%)` }}
          />
          <div className="relative flex items-center gap-4">
            <TierMedallion tier={network.tier} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Your Circle rank</p>
              <p className={cn("text-xl font-black tracking-[-0.02em]", network.tier.color)}>{network.tier.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{network.tier.tagline}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black leading-none">{network.referralCount}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invited</p>
            </div>
          </div>

          {/* Progress to next */}
          {nextTierInfo && (
            <div className="relative space-y-2 mt-5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {nextTierInfo.remaining} more to <nextTierInfo.next.icon className="h-3 w-3" aria-hidden /> {nextTierInfo.next.label}
                </span>
                <span>{network.referralCount}/{nextTierInfo.next.minReferrals}</span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
            </div>
          )}

          {/* Active rewards */}
          {network.tier.tier !== "none" && (
            <div className="relative flex flex-wrap gap-2 mt-4">
              {network.tier.rewards.freeProMonths !== 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Gift className="h-3 w-3 mr-1" />
                  {getProRewardText(network.tier)}
                </Badge>
              )}
              {network.tier.rewards.feeDiscount > 0 && (
                <Badge className="border-primary/20 bg-primary/10 text-primary">
                  {network.tier.rewards.feeDiscount}% off fees
                </Badge>
              )}
              {network.tier.rewards.commissionRate > 0 && (
                <Badge style={{ backgroundColor: "hsl(var(--accent-pay)/0.1)", color: "hsl(var(--accent-pay))", borderColor: "hsl(var(--accent-pay)/0.2)" }}>
                  {network.tier.rewards.commissionRate}% commission
                </Badge>
              )}
              <Badge className="bg-muted text-muted-foreground">
                +{network.tier.rewards.statusBonusPoints} Status pts
              </Badge>
            </div>
          )}

          {/* Kreto, cheering the climb on -- same mascot presence used on
              Today and New Room, absent only for a brand-new member with
              nothing yet to celebrate. */}
          {network.tier.tier !== "none" && (
            <div className="absolute right-3 bottom-0 hidden sm:block opacity-90 pointer-events-none" aria-hidden>
              <KretoCharacter variant="main" size={84} floatAmplitude={2} floatDuration={9} />
            </div>
          )}
        </div>
      </HoloCard>

      {/* Network Stats — commission is shown as one honest lifetime-earned
          total. The schema has no pending/eligible/approved/paid breakdown,
          so no such split is claimed here — see STUDIO_REFERENCE_SURFACE_AUDIT.md. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center rounded-2xl shadow-none border-border/60">
          <div className="text-2xl font-bold">{network.referralCount}</div>
          <div className="text-xs text-muted-foreground">Direct Invites</div>
        </Card>
        <Card className="p-4 text-center rounded-2xl shadow-none border-border/60">
          <div className="text-2xl font-bold">{network.totalNetworkSize}</div>
          <div className="text-xs text-muted-foreground">Your Reach</div>
        </Card>
        <Card className="p-4 text-center rounded-2xl shadow-none border-border/60">
          <div className="text-2xl font-bold">{network.longestChain}</div>
          <div className="text-xs text-muted-foreground">Extended Circle</div>
        </Card>
        <Card className="p-4 text-center rounded-2xl shadow-none border-border/60">
          <div className="text-2xl font-bold text-[hsl(var(--energy))]">${network.commissionEarned.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">Commission Earned</div>
        </Card>
      </div>

      {/* Invite Action */}
      <Card className="overflow-hidden rounded-2xl shadow-none border-border/60">
        <div className="p-5 space-y-4">
          <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: "hsl(var(--energy))" }} />
            Invite Creatives
          </h2>

          {personalLink ? (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Your personal invite link
                </p>
                <code className="text-xs font-mono block truncate">{personalLink.replace("https://", "")}</code>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowQR(!showQR)} className="gap-1.5">
                  <QrCode className="h-4 w-4" /> QR
                </Button>
                <Button variant="outline" size="sm" onClick={shareNative} className="gap-1.5">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <Button size="sm" onClick={copyLink} className="gap-1.5">
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              {showQR && (
                <div className="flex justify-center pt-2">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG value={personalLink} size={160} level="H" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Complete your profile to get your invite link</p>
            </div>
          )}
        </div>
      </Card>

      {/* How It Works */}
      <Card className="p-5 rounded-2xl shadow-none" style={{ borderColor: "hsl(var(--energy) / 0.15)", backgroundColor: "hsl(var(--energy) / 0.05)" }}>
        <h3 className="font-bold text-sm tracking-tight mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" style={{ color: "hsl(var(--energy))" }} />
          How Creative Circle Works
        </h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0 text-xs font-bold" style={{ color: "hsl(var(--energy))" }}>1</div>
            <div><span className="font-medium text-foreground">Invite creatives</span> using your personal link, QR code, or direct share</div>
          </div>
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0 text-xs font-bold" style={{ color: "hsl(var(--energy))" }}>2</div>
            <div><span className="font-medium text-foreground">Level up your tier</span> as more people join through you — unlock free Pro, reduced fees, and status points</div>
          </div>
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0 text-xs font-bold" style={{ color: "hsl(var(--energy))" }}>3</div>
            <div><span className="font-medium text-foreground">Earn passive commission</span> from Kretopia's service fee when your referrals complete paid gigs — they keep 100% of their earnings</div>
          </div>
        </div>
      </Card>

      {/* All Tiers */}
      <div className="space-y-3">
        <h2 className="font-bold text-lg tracking-tight">Tier Rewards</h2>
        <p className="text-sm text-muted-foreground">Each tier unlocks more rewards. Invite creatives to climb the ranks.</p>

        {allTiers.map((tier) => {
          const isActive = tier.tier === network.tier.tier;
          const isUnlocked = network.referralCount >= tier.minReferrals;
          return (
            <Card
              key={tier.tier}
              className={cn(
                "p-4 rounded-2xl shadow-none border-border/60 transition-colors",
                isActive && "border-[hsl(var(--energy)/0.4)] bg-[hsl(var(--energy)/0.05)] ring-1 ring-[hsl(var(--energy)/0.2)]",
                isUnlocked && !isActive && "bg-muted/10",
                !isUnlocked && "opacity-50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <TierMedallion tier={tier} size="sm" active={isUnlocked} />
                  <div>
                    <span className={cn("font-bold", isActive ? tier.color : "text-foreground")}>{tier.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{tier.minReferrals}+ invites</span>
                  </div>
                  {isActive && <Badge variant="default" className="text-[9px] px-1.5">You</Badge>}
                </div>
                {isUnlocked && !isActive && <Badge variant="secondary" className="text-[9px]">Unlocked</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mb-3 italic">{tier.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                {tier.perks.map((perk) => (
                  <span key={perk} className="text-[10px] px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground font-medium">
                    {perk}
                  </span>
                ))}
              </div>
            </Card>
          );
        })}

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Commission is earned from Kretopia's platform fee — your referrals keep 100% of their earnings. This isn't MLM — it's supporting each other to grow.
        </p>
      </div>
      </StudioFeatureShell>
    </div>
  );
};

export default CreativeCircle;
