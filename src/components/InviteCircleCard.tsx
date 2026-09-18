import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { InviteDialog } from "@/components/InviteDialog";
import { getNetworkTier, getReferralsToNextTier } from "@/lib/referralEngine";
import { ArrowRight, Sparkles, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "home" | "profile" | "match";

interface InviteCircleCardProps {
  variant?: Variant;
  className?: string;
}

/**
 * Status-aware invite prompt that surfaces the Creative Circle tier system
 * contextually on Home, Profile, and Match. Drives the viral loop by tying
 * each invite to a tangible reward (free Pro, fee discounts, commission).
 */
export const InviteCircleCard = ({ variant = "home", className }: InviteCircleCardProps) => {
  const { user } = useAuth();
  const [referralCount, setReferralCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("invites")
        .select("current_uses")
        .eq("inviter_id", user.id);
      if (!active) return;
      const total = (data || []).reduce((s: number, r: any) => s + (r.current_uses || 0), 0);
      setReferralCount(total);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [user?.id]);

  if (!user || !loaded) return null;

  const tier = getNetworkTier(referralCount);
  const next = getReferralsToNextTier(referralCount);

  // Copy variants — status, scarcity, specificity
  const headline = (() => {
    if (referralCount === 0) {
      switch (variant) {
        case "profile": return "Your Circle starts with one.";
        case "match":   return "Better matches come from bigger circles.";
        default:        return "Build your Circle. Unlock perks.";
      }
    }
    if (next) {
      switch (variant) {
        case "profile": return `${next.remaining} more to reach ${next.next.label}`;
        case "match":   return `${next.remaining} invites to ${next.next.label} status`;
        default:        return `You're ${next.remaining} away from ${next.next.label}`;
      }
    }
    return "You're an Icon. Keep building.";
  })();

  const subline = (() => {
    if (referralCount === 0) {
      return "Invite 1 creator → +50 status points · 6 → 1 month free Pro · 20 → 3% commission for life.";
    }
    if (next) {
      const reward = next.next.rewards;
      const bits: string[] = [];
      if (reward.freeProMonths === "lifetime") bits.push("Lifetime Pro");
      else if (reward.freeProMonths) bits.push(`${reward.freeProMonths}mo free Pro`);
      if (reward.feeDiscount) bits.push(`${reward.feeDiscount}% off fees`);
      if (reward.commissionRate) bits.push(`${reward.commissionRate}% commission`);
      return bits.length ? `Unlock: ${bits.join(" · ")}` : "Keep building your network.";
    }
    return "You've built one of the strongest networks on Kretopia.";
  })();

  const Icon = referralCount === 0 ? Sparkles : next ? Users : Crown;

  // Visual progress
  const progressPct = next
    ? Math.min(100, (referralCount / next.next.minReferrals) * 100)
    : 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-4 text-left transition-all hover:border-primary/50 hover:shadow-glow",
          className
        )}
        aria-label="Open invite dialog and grow your Creative Circle"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex items-start gap-3">
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card",
            tier.ringClass.replace("ring-", "border-")
          )}>
            <tier.icon className={cn("h-5 w-5", tier.color)} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Creative Circle · {tier.label}
              </span>
              {referralCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {referralCount} invited
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-foreground leading-tight">
              {headline}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-snug line-clamp-2">
              {subline}
            </p>

            {/* Progress bar to next tier */}
            {next && (
              <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </button>

      <InviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
