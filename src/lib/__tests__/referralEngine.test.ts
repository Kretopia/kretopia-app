import { describe, it, expect } from "vitest";
import { getAllNetworkTiers, getNetworkTier, getNextNetworkTier, getReferralsToNextTier } from "@/lib/referralEngine";

describe("referralEngine", () => {
  it("every tier's icon is a real component, not an emoji string", () => {
    // Regression: this used to be a literal emoji glyph ("👤", "⚡", "🔗"...)
    // rendered as text in InviteCircleCard/InviteCard/CreativeCircleBadge/
    // NetworkVisualization/CreativeCircle. Guards against any of those
    // call sites (or a future one) reverting to a string icon.
    for (const tier of getAllNetworkTiers()) {
      // lucide-react icons are forwardRef components -- typeof "object"
      // with a $$typeof of Symbol(react.forward_ref), not a plain
      // function -- so the real regression guard is "not a string",
      // not a stricter function check that a legitimate icon would fail.
      expect(typeof tier.icon).not.toBe("string");
      expect(tier.icon).toBeTruthy();
    }
  });

  it("uses Kretopia's own tokens for every unlockable tier, not arbitrary stock hues", () => {
    // Regression: tiers used to cycle through unrelated Tailwind colors
    // (amber-500, orange-500, emerald-500, amber-400) with no meaning in
    // Kretopia's own design system, which retired its old multi-hue
    // "signal" palette in favor of one dominant --energy/--primary brand
    // color. Every real tier's color/gradient/ring should reference one
    // of those two tokens (or Tailwind's `primary`/`accent` aliases of
    // them), never a raw Tailwind color name.
    const offBrandHue = /\b(amber|orange|emerald|yellow|red|blue|purple|pink)-\d/;
    for (const tier of getAllNetworkTiers().filter((t) => t.tier !== "none")) {
      expect(tier.color).not.toMatch(offBrandHue);
      expect(tier.gradient).not.toMatch(offBrandHue);
      expect(tier.ringClass).not.toMatch(offBrandHue);
    }
  });

  it("orders tiers by ascending minReferrals", () => {
    const tiers = getAllNetworkTiers();
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].minReferrals).toBeGreaterThan(tiers[i - 1].minReferrals);
    }
  });

  it("getNetworkTier picks the highest tier the count actually qualifies for", () => {
    expect(getNetworkTier(0).tier).toBe("none");
    expect(getNetworkTier(1).tier).toBe("spark");
    expect(getNetworkTier(7).tier).toBe("spark");
    expect(getNetworkTier(8).tier).toBe("connector");
    expect(getNetworkTier(100).tier).toBe("icon");
    expect(getNetworkTier(9999).tier).toBe("icon");
  });

  it("getNextNetworkTier returns null past the top tier", () => {
    expect(getNextNetworkTier("icon")).toBeNull();
    expect(getNextNetworkTier("spark")?.tier).toBe("connector");
  });

  it("getReferralsToNextTier reports the real remaining gap", () => {
    const info = getReferralsToNextTier(5);
    expect(info?.next.tier).toBe("connector");
    expect(info?.remaining).toBe(3);

    expect(getReferralsToNextTier(100)).toBeNull();
  });
});
