// Mode-aware Stripe Price ID resolution for subscription checkout.
//
// Mirrors the test/live separation in stripeEnv.ts (`STRIPE_MODE`). Before
// this module, the price IDs a Checkout Session used were a single hardcoded
// live-mode list (see src/lib/subscriptionConfig.ts), while
// resolveStripeSecretKey() already picked a test or live secret key
// depending on STRIPE_MODE. Mixing a test-mode key with a live-mode Price ID
// (or vice versa) is rejected by Stripe with:
//   "a similar object exists in live mode, but a test mode key was used"
// This module makes Price ID selection follow the same STRIPE_MODE switch as
// the secret key, so the two can never disagree.
//
// Live-mode Price IDs below are the real, already-in-production values
// (mirrored from src/lib/subscriptionConfig.ts — the frontend's
// display-only copy of the same IDs). Test-mode Price IDs are intentionally
// NOT hardcoded: nobody should fabricate a Stripe Price ID. Someone with
// Stripe Dashboard access must create matching test-mode Products/Prices and
// set the STRIPE_PRICE_*_TEST env vars referenced below. Until that's done,
// STRIPE_MODE=test checkout fails closed with a clear configuration error
// instead of silently sending a live-mode ID to a test-mode key (or the
// reverse).

import { getStripeMode } from "./stripeEnv.ts";

export type SubscriptionTier = "pro" | "creator_pro" | "brand_pro" | "brand_enterprise";
export type PriceInterval = "monthly" | "yearly";

interface PriceEntry {
  /** Live-mode Stripe Price ID — already correct/live in production. */
  live: string;
  /** Env var name holding the matching TEST-mode Stripe Price ID. */
  testEnvVar: string;
}

const PRICE_TABLE: Record<SubscriptionTier, Record<PriceInterval, PriceEntry>> = {
  pro: {
    monthly: { live: "price_1TLWQjJvOS7zG18h7aQBNmo8", testEnvVar: "STRIPE_PRICE_PRO_MONTHLY_TEST" },
    yearly: { live: "price_1TLWQ6JvOS7zG18hjaiygUxE", testEnvVar: "STRIPE_PRICE_PRO_YEARLY_TEST" },
  },
  creator_pro: {
    monthly: { live: "price_1TLWQkJvOS7zG18hSN9qmxyW", testEnvVar: "STRIPE_PRICE_CREATOR_PRO_MONTHLY_TEST" },
    yearly: { live: "price_1TLWQRJvOS7zG18hLQJW4YIB", testEnvVar: "STRIPE_PRICE_CREATOR_PRO_YEARLY_TEST" },
  },
  brand_pro: {
    monthly: { live: "price_1TLWQlJvOS7zG18hb5QeNh8k", testEnvVar: "STRIPE_PRICE_BRAND_PRO_MONTHLY_TEST" },
    yearly: { live: "price_1TLWQbJvOS7zG18hgPTf5C0g", testEnvVar: "STRIPE_PRICE_BRAND_PRO_YEARLY_TEST" },
  },
  brand_enterprise: {
    monthly: { live: "price_1TLWQmJvOS7zG18h4AVxAVKx", testEnvVar: "STRIPE_PRICE_BRAND_ENTERPRISE_MONTHLY_TEST" },
    yearly: { live: "price_1TLWQcJvOS7zG18hD1oVzrrJ", testEnvVar: "STRIPE_PRICE_BRAND_ENTERPRISE_YEARLY_TEST" },
  },
};

/** Founder Circle is a one-time (non-subscription) purchase, kept separate from the tier table above. */
const FOUNDER_PRICE: PriceEntry = {
  live: "price_1T1O6yJvOS7zG18hgCeJU1cF",
  testEnvVar: "STRIPE_PRICE_FOUNDER_TEST",
};

function resolveEntry(entry: PriceEntry): string {
  const mode = getStripeMode();
  if (mode === "live") return entry.live;

  const testId = Deno.env.get(entry.testEnvVar);
  if (!testId) {
    throw new Error(
      `STRIPE_MODE=test but ${entry.testEnvVar} is not configured. ` +
        `Create a matching test-mode Price in the Stripe Dashboard (test mode) and set ${entry.testEnvVar} ` +
        `as a Supabase secret — a live-mode Price ID cannot be used with a test-mode Stripe key.`
    );
  }
  return testId;
}

export function isKnownSubscriptionTier(tier: string): tier is SubscriptionTier {
  return Object.prototype.hasOwnProperty.call(PRICE_TABLE, tier);
}

/** Resolves the correct (test- or live-mode) Stripe Price ID for a subscription tier + billing interval. */
export function resolveSubscriptionPriceId(tier: SubscriptionTier, interval: PriceInterval): string {
  const tierTable = PRICE_TABLE[tier];
  if (!tierTable) throw new Error(`Unknown subscription tier: ${tier}`);
  const entry = tierTable[interval];
  if (!entry) throw new Error(`Unknown billing interval "${interval}" for tier "${tier}"`);
  return resolveEntry(entry);
}

/** Resolves the correct (test- or live-mode) Stripe Price ID for the one-time Founder Circle purchase. */
export function resolveFounderPriceId(): string {
  return resolveEntry(FOUNDER_PRICE);
}
