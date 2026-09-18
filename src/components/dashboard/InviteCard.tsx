import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Gift, QrCode, Users, Link2, ChevronRight, TrendingUp, Zap, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { useReferralNetwork } from "@/hooks/useReferralNetwork";
import { getReferralsToNextTier, getProRewardText, getAllNetworkTiers, type NetworkTierMeta } from "@/lib/referralEngine";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface InviteCode {
  id: string;
  invite_code: string;
  current_uses: number;
  max_uses: number;
  status: string;
}

export const InviteCard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const { toast } = useToast();
  const network = useReferralNetwork();

  const primaryInvite = inviteCodes.find(i => i.current_uses < i.max_uses) || inviteCodes[0];
  const personalLink = primaryInvite ? `https://www.kretopia.com/join/${primaryInvite.invite_code}` : null;

  useEffect(() => {
    if (user) fetchInviteCodes();
  }, [user]);

  const fetchInviteCodes = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('id, invite_code, current_uses, max_uses, status')
        .eq('inviter_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setInviteCodes(data || []);
    } catch (err) {
      console.error('Error fetching invite codes:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!personalLink) return;
    try {
      const inviteMessage = `Stop cold DMing strangers for collabs.\n\nKretopia matches you with verified creatives who fit your style — portfolio-first, credits-verified.\n\nI'm already on. Join me 👇\n${personalLink}`;
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      toast({ title: "Copied!", description: "Your personal invite link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Error", description: "Failed to copy invite link", variant: "destructive" });
    }
  };

  const totalUsed = inviteCodes.reduce((sum, i) => sum + i.current_uses, 0);
  const totalSlots = inviteCodes.reduce((sum, i) => sum + i.max_uses, 0);
  const availableSlots = totalSlots - totalUsed;
  const nextTierInfo = getReferralsToNextTier(network.referralCount);

  // Progress to next tier
  const progressPercent = nextTierInfo
    ? Math.min(100, ((network.tier.minReferrals > 0 ? network.referralCount - network.tier.minReferrals : network.referralCount) /
        (nextTierInfo.next.minReferrals - network.tier.minReferrals)) * 100)
    : 100;

  if (loading || network.loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3"><div className="h-6 bg-muted rounded w-32" /></CardHeader>
        <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header with Tier Badge */}
      <CardHeader className={cn("pb-3 bg-gradient-to-r", network.tier.gradient)}>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <network.tier.icon className={cn("h-5 w-5", network.tier.color)} aria-hidden />
            <div>
              <span className="block">Creative Circle</span>
              <span className={cn("text-xs font-medium", network.tier.color)}>
                {network.tier.label} — {network.tier.tagline}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className={cn("text-[10px]", network.tier.color)}>
            {network.referralCount} invited
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Tier Progress */}
        {nextTierInfo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {nextTierInfo.remaining} more to <span className="inline-flex items-center gap-1 font-bold"><nextTierInfo.next.icon className="h-3 w-3" aria-hidden />{nextTierInfo.next.label}</span>
              </span>
              <span className="text-muted-foreground">{network.referralCount}/{nextTierInfo.next.minReferrals}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Current Rewards */}
        {network.tier.tier !== "none" && (
          <div className="grid grid-cols-3 gap-2">
            {network.tier.rewards.freeProMonths !== 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-2 text-center">
                <div className="text-xs font-bold text-primary">
                  {getProRewardText(network.tier)}
                </div>
                <div className="text-[10px] text-muted-foreground">Earned</div>
              </div>
            )}
            {network.tier.rewards.feeDiscount > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-2 text-center">
                <div className="text-xs font-bold text-primary">{network.tier.rewards.feeDiscount}% off</div>
                <div className="text-[10px] text-muted-foreground">Fees</div>
              </div>
            )}
            {network.tier.rewards.commissionRate > 0 && (
              <div className="rounded-lg p-2 text-center" style={{ backgroundColor: "hsl(var(--accent-pay)/0.06)", borderWidth: 1, borderColor: "hsl(var(--accent-pay)/0.15)" }}>
                <div className="text-xs font-bold" style={{ color: "hsl(var(--accent-pay))" }}>{network.tier.rewards.commissionRate}%</div>
                <div className="text-[10px] text-muted-foreground">Commission</div>
              </div>
            )}
          </div>
        )}

        {/* Network Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="py-2">
            <div className="text-lg font-bold">{network.referralCount}</div>
            <div className="text-[10px] text-muted-foreground">Direct</div>
          </div>
          <div className="py-2">
            <div className="text-lg font-bold">{network.totalNetworkSize}</div>
            <div className="text-[10px] text-muted-foreground">2° Network</div>
          </div>
          <div className="py-2">
            <div className="text-lg font-bold">{network.longestChain}</div>
            <div className="text-[10px] text-muted-foreground">Chain Depth</div>
          </div>
        </div>

        {/* Personal Link */}
        {!personalLink ? (
          <div className="text-center py-3">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Complete your profile to get your invite link</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={cn("rounded-lg border p-3", network.tier.ringClass.replace("ring-", "border-"))}>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Your personal invite link
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-background/80 px-2 py-1.5 rounded flex-1 truncate">
                  {personalLink.replace('https://', '')}
                </code>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setShowQR(!showQR)} className="h-8 w-8 p-0">
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="default" onClick={copyLink} className="h-8 gap-1 px-3">
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>

            {showQR && (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={personalLink} size={120} level="H" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Next Reward Preview */}
        {nextTierInfo && (
          <button
            onClick={() => setShowTiers(!showTiers)}
            className="w-full rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-3 border border-primary/20 text-left hover:from-primary/15 hover:to-accent/15 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3 text-primary" />
                  Next: <span className="inline-flex items-center gap-1 font-bold"><nextTierInfo.next.icon className="h-3 w-3" aria-hidden />{nextTierInfo.next.label}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {nextTierInfo.next.rewards.feeDiscount > 0 && `${nextTierInfo.next.rewards.feeDiscount}% off fees`}
                  {nextTierInfo.next.rewards.commissionRate > 0 && ` · ${nextTierInfo.next.rewards.commissionRate}% commission`}
                  {nextTierInfo.next.rewards.freeProMonths !== 0 && ` · ${getProRewardText(nextTierInfo.next)}`}
                </p>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showTiers && "rotate-90")} />
            </div>
          </button>
        )}

        {/* Tier Breakdown */}
        {showTiers && <TierProgressionList currentTier={network.tier.tier} referralCount={network.referralCount} />}

        {/* Link to full page */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-primary gap-1"
          onClick={() => navigate("/creative-circle")}
        >
          See all rewards & tiers <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
};

function TierProgressionList({ currentTier, referralCount }: { currentTier: string; referralCount: number }) {
  const allTiers = getAllNetworkTiers().filter(t => t.tier !== "none");

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creative Circle Tiers</p>
      {allTiers.map((tier) => {
        const isActive = tier.tier === currentTier;
        const isUnlocked = referralCount >= tier.minReferrals;
        return (
          <div
            key={tier.tier}
            className={cn(
              "rounded-lg border p-3 transition-all",
              isActive && "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
              isUnlocked && !isActive && "border-border/60 bg-muted/20",
              !isUnlocked && "border-border/30 opacity-60"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <tier.icon className={cn("h-4 w-4", isActive ? tier.color : "text-muted-foreground")} aria-hidden />
                <span className={cn("text-sm font-bold", isActive ? tier.color : "text-foreground")}>{tier.label}</span>
                {isActive && <Badge variant="default" className="text-[9px] px-1.5 py-0">You</Badge>}
                {isUnlocked && !isActive && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Unlocked</Badge>}
              </div>
              <span className="text-[10px] text-muted-foreground">{tier.minReferrals}+ invites</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tier.rewards.freeProMonths !== 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {getProRewardText(tier)}
                </span>
              )}
              {tier.rewards.feeDiscount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                  {tier.rewards.feeDiscount}% off fees
                </span>
              )}
              {tier.rewards.commissionRate > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                  {tier.rewards.commissionRate}% commission
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                +{tier.rewards.statusBonusPoints} Status pts
              </span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Commission is earned from Kretopia's platform fee — your referrals keep 100% of their earnings.
      </p>
    </div>
  );
}
