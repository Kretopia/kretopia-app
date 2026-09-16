import { describe, it, expect } from "vitest";
import { deriveTargetDateFromDeliverables } from "@/lib/deriveTargetDateFromDeliverables";

describe("deriveTargetDateFromDeliverables", () => {
  it("returns the latest due date across all deliverables", () => {
    const result = deriveTargetDateFromDeliverables([
      { due_date: "2026-08-01" },
      { due_date: "2026-08-15" },
      { due_date: "2026-08-05" },
    ]);
    expect(result).toBe("2026-08-15");
  });

  it("skips deliverables with no due date", () => {
    const result = deriveTargetDateFromDeliverables([
      { due_date: null },
      { due_date: "2026-09-01" },
      {},
    ]);
    expect(result).toBe("2026-09-01");
  });

  it("skips unparseable due dates rather than throwing", () => {
    const result = deriveTargetDateFromDeliverables([
      { due_date: "next Friday-ish" },
      { due_date: "2026-10-10" },
    ]);
    expect(result).toBe("2026-10-10");
  });

  it("returns null when no deliverable has a real parseable due date", () => {
    expect(deriveTargetDateFromDeliverables([{ due_date: null }, { due_date: "tbd" }])).toBeNull();
  });

  it("returns null for an empty or undefined deliverables list", () => {
    expect(deriveTargetDateFromDeliverables([])).toBeNull();
    expect(deriveTargetDateFromDeliverables(undefined)).toBeNull();
  });
});
