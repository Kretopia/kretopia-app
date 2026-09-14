// Canonical platform service fee schedule for talent/brand milestone payments
// (create-milestone-payment). Mirrors src/lib/platformFees.ts (the client-side
// copy shown to users on the pricing page and fee calculator) -- the two must
// be kept in sync by hand since edge functions (Deno) and the Vite client
// bundle can't share a single module. If you change a rate here, change it
// there too, and vice versa.
//
// Tiers reflect the live `profiles_subscription_tier_check` constraint
// (free, pro, studio, enterprise, founder, brand_pro, brand_enterprise) plus
// the legacy `creator_pro` value that can still exist on old rows even though
// it's no longer newly assignable.
export const PLATFORM_FEE_RATES: Record<string, number> = {
  free: 0.15,
  pro: 0.10,
  creator_pro: 0.05,
  brand_pro: 0.10,
  brand_enterprise: 0.05,
  founder: 0.05,
  studio: 0.10,
  enterprise: 0.05,
};

export const getPlatformFeeRate = (tier: string | null): number => {
  return PLATFORM_FEE_RATES[tier || "free"] ?? PLATFORM_FEE_RATES.free;
};
