import { describe, it, expect } from "vitest";
import { parseTaskDueDate } from "@/lib/parseTaskDueDate";

describe("parseTaskDueDate", () => {
  it("returns a full ISO timestamp for a valid date string", () => {
    expect(parseTaskDueDate("2026-08-15")).toBe(new Date("2026-08-15").toISOString());
  });

  it("returns null for an unparseable string rather than throwing", () => {
    expect(parseTaskDueDate("next Friday-ish")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseTaskDueDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseTaskDueDate(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseTaskDueDate("")).toBeNull();
  });
});
