// Mode-aware Stripe Price ID resolution for subscription checkout.
//
// Mirrors the test/live split in stripeEnv.ts. Before this module,
// `create-checkout` trusted a raw Stripe Price ID sent by the client — but
// the only Price IDs the client ever has are the LIVE ones baked into
// src/lib/subscriptionConfig.ts. When STRIPE_MODE=test, that live Price ID
// got handed straight to stripe.checkout.sessions.create() alongside a
// test-mode secret key, and Stripe rejects the cross-mode reference outright
// (you cannot create a test-mode Checkout Session against a live-mode
// Price). Every test-mode checkout attempt failed as a result.
//
// The fix: the client sends a stable (plan, interval) pair instead of a raw
// Price ID, and the server resolves the actual Stripe Price ID for the
// *active* STRIPE_MODE here — mirroring resolveStripeSecretKey()'s
// fail-closed test/live split.
//
// Live IDs below must stay in sync with src/lib/subscriptionConfig.ts.
// Test IDs are NOT guessable — they must be created in the Stripe test
// dashboard and wired up via env vars (see testEnvVarName below). There is
// intentionally no fallback to the live ID when a test one is missing: that
// would silently reintroduce the exact bug this module fixes.

import { getStripeMode } from "./stripeEnv.ts";

export type SubscriptionPlanKey = "pro" | "creator_pro" | "brand_pro" | "brand_enterprise";
export type SubscriptionInterval = "monthly" | "yearly";

const PLAN_KEYS: readonly SubscriptionPlanKey[] = ["pro", "creator_pro", "brand_pro", "brand_enterprise"];
const INTERVALS: readonly SubscriptionInterval[] = ["monthly", "yearly"];

export function isSubscriptionPlanKey(value: unknown): value is SubscriptionPlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

export function isSubscriptionInterval(value: unknown): value is SubscriptionInterval {
  return typeof value === "string" && (INTERVALS as readonly string[]).includes(value);
}

// Live-mode Price IDs — keep in sync with SUBSCRIPTION_PRODUCTS /
// BRAND_SUBSCRIPTION_PRODUCTS in src/lib/subscriptionConfig.ts.
const LIVE_PRICE_IDS: Record<SubscriptionPlanKey, Record<SubscriptionInterval, string>> = {
  pro: {
    monthly: "price_1TLWQjJvOS7zG18h7aQBNmo8",
    yearly: "price_1TLWQ6JvOS7zG18hjaiygUxE",
  },
  creator_pro: {
    monthly: "price_1TLWQkJvOS7zG18hSN9qmxyW",
    yearly: "price_1TLWQRJvOS7zG18hLQJW4YIB",
  },
  brand_pro: {
    monthly: "price_1TLWQlJvOS7zG18hb5QeNh8k",
    yearly: "price_1TLWQbJvOS7zG18hgPTf5C0g",
  },
  brand_enterprise: {
    monthly: "price_1TLWQmJvOS7zG18h4AVxAVKx",
    yearly: "price_1TLWQcJvOS7zG18hD1oVzrrJ",
  },
};

// e.g. STRIPE_PRICE_PRO_MONTHLY_TEST, STRIPE_PRICE_BRAND_ENTERPRISE_YEARLY_TEST
function testEnvVarName(plan: SubscriptionPlanKey, interval: SubscriptionInterval): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}_TEST`;
}

/**
 * Resolve the correct Stripe Price ID for the active STRIPE_MODE. Throws
 * (fail-closed) rather than falling back to a live ID when a test-mode
 * override isn't configured yet.
 */
export function resolveSubscriptionPriceId(plan: SubscriptionPlanKey, interval: SubscriptionInterval): string {
  const mode = getStripeMode();

  if (mode === "test") {
    const envVar = testEnvVarName(plan, interval);
    const priceId = Deno.env.get(envVar);
    if (!priceId) {
      throw new Error(
        `STRIPE_MODE=test but ${envVar} is not configured (needed for ${plan}/${interval} checkout)`
      );
    }
    return priceId;
  }

  return LIVE_PRICE_IDS[plan][interval];
}
