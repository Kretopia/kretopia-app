// Platform service fee structure — charged TO THE BRAND/COMPANY on top of talent rate
// Talent receives 100% of their quoted rate
// Platform fees reduced 5% across the board (focus group feedback Apr 2026)
// Mirrored in supabase/functions/_shared/platformFees.ts (the rate actually
// charged server-side for milestone payments) -- keep both in sync by hand.
export const PLATFORM_FEES = {
  free: 0.15,             // was 20% — 15% service fee for free brands
  pro: 0.10,              // was 15% — 10% for Creator
  creator_pro: 0.05,      // was 10% — 5% for Creator+
  brand_pro: 0.10,        // was 15% — 10% for Brand Pro
  brand_enterprise: 0.05, // was 10% — 5% for Brand Enterprise
  founder: 0.05,          // was 10% — 5% for Founder Circle brands
} as const;

// Manager commission rate — also charged to the brand on top
export const MANAGER_COMMISSION_RATE = 0.10; // 10%

export type SubscriptionTier = keyof typeof PLATFORM_FEES;

export const getPlatformFeePercentage = (tier: string | null): number => {
  if (!tier || tier === 'free') return PLATFORM_FEES.free;
  if (tier === 'founder') return PLATFORM_FEES.founder;
  if (tier === 'creator_pro') return PLATFORM_FEES.creator_pro;
  if (tier === 'pro') return PLATFORM_FEES.pro;
  if (tier === 'brand_pro') return PLATFORM_FEES.brand_pro;
  if (tier === 'brand_enterprise') return PLATFORM_FEES.brand_enterprise;
  if (tier === 'studio') return PLATFORM_FEES.pro;
  // Legacy: old "enterprise" tier maps to creator_pro
  if (tier === 'enterprise') return PLATFORM_FEES.creator_pro;
  return PLATFORM_FEES.free;
};

// Calculate platform service fee charged to the brand (on top of talent rate)
export const calculatePlatformFee = (talentRate: number, tier: string | null): number => {
  const feePercentage = getPlatformFeePercentage(tier);
  return Math.round(talentRate * feePercentage * 100) / 100;
};

export const calculatePlatformFeeInCents = (amountInCents: number, tier: string | null): number => {
  const feePercentage = getPlatformFeePercentage(tier);
  return Math.round(amountInCents * feePercentage);
};

// Calculate manager commission charged to the brand (on top of talent rate)
export const calculateManagerCommission = (talentRate: number, hasManager: boolean): number => {
  if (!hasManager) return 0;
  return Math.round(talentRate * MANAGER_COMMISSION_RATE * 100) / 100;
};

// Calculate total amount the brand pays
export const calculateBrandTotal = (
  talentRate: number,
  tier: string | null,
  hasManager: boolean = false
): {
  talentPayout: number;
  platformFee: number;
  managerCommission: number;
  stripeFee: number;
  brandTotal: number;
} => {
  const platformFee = calculatePlatformFee(talentRate, tier);
  const managerCommission = calculateManagerCommission(talentRate, hasManager);
  const subtotal = talentRate + platformFee + managerCommission;
  const stripeFee = Math.round((subtotal * 0.029 + 0.30) * 100) / 100;
  const brandTotal = Math.round((subtotal + stripeFee) * 100) / 100;

  return {
    talentPayout: talentRate,
    platformFee,
    managerCommission,
    stripeFee,
    brandTotal,
  };
};

export const getFeeDisplayText = (tier: string | null): string => {
  const percentage = getPlatformFeePercentage(tier);
  return `${(percentage * 100).toFixed(0)}%`;
};
