import { describe, it, expect } from "vitest";
import { inferPaymentsInvolved } from "@/lib/inferPaymentsInvolved";

describe("inferPaymentsInvolved", () => {
  it("infers paid work from client/budget language", () => {
    expect(inferPaymentsInvolved("A brand campaign for a client, budget is $5,000")).toBe(true);
  });

  it("infers paid work from an explicit day rate or invoice mention", () => {
    expect(inferPaymentsInvolved("Two-day shoot, my day rate applies, I'll send an invoice after")).toBe(true);
  });

  it("infers paid work from sponsorship language", () => {
    expect(inferPaymentsInvolved("Sponsored content series for a new brand launch")).toBe(true);
  });

  it("infers unpaid/personal work from explicit personal-project language", () => {
    expect(inferPaymentsInvolved("A personal project, just for fun, no budget")).toBe(false);
  });

  it("infers unpaid work from a favor-for-a-friend mention", () => {
    expect(inferPaymentsInvolved("Quick edit as a favor for a friend, unpaid")).toBe(false);
  });

  it("returns null (no guess) when the text carries no real signal either way", () => {
    expect(inferPaymentsInvolved("A three-day fashion shoot in Port of Spain, crew of six")).toBeNull();
  });

  it("returns null for empty input rather than defaulting to a guess", () => {
    expect(inferPaymentsInvolved("")).toBeNull();
  });
});
