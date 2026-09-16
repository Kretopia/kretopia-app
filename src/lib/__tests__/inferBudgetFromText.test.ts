import { describe, it, expect } from "vitest";
import { inferBudgetFromText } from "@/lib/inferBudgetFromText";

describe("inferBudgetFromText", () => {
  it("extracts a comma-formatted dollar amount", () => {
    expect(inferBudgetFromText("Spring brand launch for Acme, budget is $2,000")).toBe("$2,000");
  });

  it("extracts a plain dollar amount", () => {
    expect(inferBudgetFromText("Two-day shoot, $500 total")).toBe("$500");
  });

  it("extracts a 'k' shorthand amount", () => {
    expect(inferBudgetFromText("Sponsored campaign, budget around $5k")).toBe("$5k");
  });

  it("extracts a decimal 'k' shorthand amount", () => {
    expect(inferBudgetFromText("$2.5k for the full production")).toBe("$2.5k");
  });

  it("returns null when no dollar amount appears", () => {
    expect(inferBudgetFromText("A three-day fashion shoot in Port of Spain, crew of six")).toBeNull();
  });

  it("does not treat a bare number as a budget signal", () => {
    expect(inferBudgetFromText("3 days, 6 people, 2 revisions")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(inferBudgetFromText("")).toBeNull();
  });
});
