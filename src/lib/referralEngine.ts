/**
 * Creative Circle — 6° Network Referral Engine
 *
 * A prestige-based referral system inspired by "six degrees of separation"
 * where inviting creatives builds your professional network tier,
 * unlocking rewards that compound: free Pro, reduced fees, and commissions.
 *
 * Tier Names (network/influence-inspired):
 * Spark → Connector → Catalyst → Networker → Mogul → Icon
 */

import { User, Zap, Link2, Flame, Globe, Crown, Gem, type LucideIcon } from "lucide-react";

export type NetworkTier = "none" | "spark" | "connector" | "catalyst" | "networker" | "mogul" | "icon";

export interface NetworkTierMeta {
  tier: NetworkTier;
  label: string;
  tagline: string;
  minReferrals: number;
  /** A real Kretopia icon component, not an emoji glyph -- render as
   *  `<tier.icon className="..." />`, never `{tier.icon}` as text. */
  icon: LucideIcon;
  color: string;
  gradient: string;
  ringClass: string;
  rewards: {
    freeProMonths: number | "lifetime";
    feeDiscount: number;        // % off platform fees
    commissionRate: number;     // % of referred users' transaction fees
    statusBonusPoints: number;  // bonus ThriveStatus points
  };
  perks: string[];
}

const TIER_ORDER: NetworkTier[] = ["none", "spark", "connector", "catalyst", "networker", "mogul", "icon"];

// One brand color (--energy, Kretopia's pink), not a per-tier rainbow --
// the app retired its old multi-hue "signal" palette in favor of a
// single dominant accent (see --signal-pink/amber/violet/teal in
// index.css, all now aliased to --energy). Tiers read as increasingly
// prestigious through rising --energy intensity and glow, the same way
// every other themed surface in the app differentiates state, instead
// of cycling through unrelated Tailwind stock hues (amber/orange/
// emerald) that have no meaning in Kretopia's own design system.
const TIER_META: Record<NetworkTier, NetworkTierMeta> = {
  none: {
    tier: "none",
    label: "Member",
    tagline: "Start building your creative network",
    minReferrals: 0,
    icon: User,
    color: "text-muted-foreground",
    gradient: "from-muted/20 to-muted/5",
    ringClass: "ring-border",
    rewards: { freeProMonths: 0, feeDiscount: 0, commissionRate: 0, statusBonusPoints: 0 },
    perks: ["Personal invite link", "QR code sharing"],
  },
  spark: {
    tier: "spark",
    label: "Spark",
    tagline: "You lit the first flame",
    minReferrals: 1,
    icon: Zap,
    color: "text-[hsl(var(--energy))]",
    gradient: "from-[hsl(var(--energy)/0.16)] to-[hsl(var(--energy)/0.03)]",
    ringClass: "ring-[hsl(var(--energy)/0.35)]",
    rewards: { freeProMonths: 0, feeDiscount: 0, commissionRate: 0, statusBonusPoints: 50 },
    perks: ["+50 Status Points", "1 week Pro extension per invite", "\"Referred by\" badge on invitees"],
  },
  connector: {
    tier: "connector",
    label: "Connector",
    tagline: "Your network is growing",
    minReferrals: 8,
    icon: Link2,
    color: "text-[hsl(var(--energy))]",
    gradient: "from-[hsl(var(--energy)/0.22)] to-[hsl(var(--energy)/0.04)]",
    ringClass: "ring-[hsl(var(--energy)/0.45)]",
    rewards: { freeProMonths: 1, feeDiscount: 5, commissionRate: 0, statusBonusPoints: 200 },
    perks: ["1 month free Pro", "5% reduced fees", "Priority in search", "Profile badge"],
  },
  catalyst: {
    tier: "catalyst",
    label: "Catalyst",
    tagline: "You accelerate the industry",
    minReferrals: 20,
    icon: Flame,
    color: "text-primary",
    gradient: "from-primary/22 to-primary/4",
    ringClass: "ring-primary/50",
    rewards: { freeProMonths: 3, feeDiscount: 10, commissionRate: 3, statusBonusPoints: 500 },
    perks: ["3 months free Pro", "10% reduced fees", "3% passive commission", "Featured spotlight"],
  },
  networker: {
    tier: "networker",
    label: "Networker",
    tagline: "Industry knows your circle",
    minReferrals: 35,
    icon: Globe,
    color: "text-[hsl(var(--energy))]",
    gradient: "from-[hsl(var(--energy)/0.28)] via-primary/10 to-[hsl(var(--energy)/0.04)]",
    ringClass: "ring-[hsl(var(--energy)/0.55)]",
    rewards: { freeProMonths: 6, feeDiscount: 15, commissionRate: 5, statusBonusPoints: 1000 },
    perks: ["6 months free Pro", "15% reduced fees", "5% passive commission", "Early feature access"],
  },
  mogul: {
    tier: "mogul",
    label: "Mogul",
    tagline: "You move the industry",
    minReferrals: 50,
    icon: Crown,
    color: "text-[hsl(var(--energy))]",
    gradient: "from-[hsl(var(--energy)/0.34)] via-accent/15 to-[hsl(var(--energy)/0.05)]",
    ringClass: "ring-[hsl(var(--energy)/0.7)] shadow-glow",
    rewards: { freeProMonths: 12, feeDiscount: 20, commissionRate: 7, statusBonusPoints: 2000 },
    perks: ["1 year free Pro", "20% reduced fees", "7% passive commission", "Platform advisory input"],
  },
  icon: {
    tier: "icon",
    label: "Icon",
    tagline: "Legendary network builder",
    minReferrals: 100,
    icon: Gem,
    color: "text-primary",
    gradient: "from-primary/25 via-accent/15 to-primary/5",
    ringClass: "ring-primary shadow-glow",
    rewards: { freeProMonths: "lifetime", feeDiscount: 25, commissionRate: 10, statusBonusPoints: 5000 },
    perks: ["Lifetime free Pro", "25% reduced fees", "10% passive commission", "Founding Circle perks"],
  },
};

export function getNetworkTierIndex(tier: NetworkTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function getNetworkTier(referralCount: number): NetworkTierMeta {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (referralCount >= TIER_META[tier].minReferrals) {
      return TIER_META[tier];
    }
  }
  return TIER_META.none;
}

export function getNextNetworkTier(currentTier: NetworkTier): NetworkTierMeta | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx >= TIER_ORDER.length - 1) return null;
  return TIER_META[TIER_ORDER[idx + 1]];
}

export function getReferralsToNextTier(referralCount: number): { next: NetworkTierMeta; remaining: number } | null {
  const current = getNetworkTier(referralCount);
  const next = getNextNetworkTier(current.tier);
  if (!next) return null;
  return { next, remaining: next.minReferrals - referralCount };
}

export function getAllNetworkTiers(): NetworkTierMeta[] {
  return TIER_ORDER.map(t => TIER_META[t]);
}

export function getCommissionExplanation(tier: NetworkTierMeta): string {
  if (tier.rewards.commissionRate === 0) return "";
  return `You earn ${tier.rewards.commissionRate}% of the platform service fee when your referrals complete paid gigs. This comes from Kretopia's cut — your referrals keep 100% of their earnings.`;
}

export function getProRewardText(tier: NetworkTierMeta): string {
  const months = tier.rewards.freeProMonths;
  if (months === 0) return "";
  if (months === "lifetime") return "Lifetime Pro";
  if (months >= 12) return `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""} free Pro`;
  return `${months} month${months > 1 ? "s" : ""} free Pro`;
}
