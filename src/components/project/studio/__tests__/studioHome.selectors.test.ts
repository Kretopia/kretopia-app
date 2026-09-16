import { describe, it, expect } from "vitest";
import { prioritizeProjects, computeFolderCounts, defaultVisibleProjectCount } from "../studioHome.selectors";
import type { StudioProject } from "../studioCardHelpers";

/**
 * Pure-function coverage for Studio home's prioritization/scalability
 * logic -- the one place this ordering exists, per the overhaul's
 * anti-duplication requirement. Every case below uses only real fields
 * (status, updated_at, invoice state) already loaded by WorkHome today.
 */

const proj = (id: string, status: string, updatedAt: string): StudioProject => ({
  id,
  title: id,
  status,
  updated_at: updatedAt,
} as StudioProject);

describe("prioritizeProjects", () => {
  it("ranks a delivered-but-unbilled project above an active one", () => {
    const list = [
      proj("active", "active", "2026-01-01T00:00:00Z"),
      proj("needsInvoice", "completed", "2026-01-01T00:00:00Z"),
    ];
    const sorted = prioritizeProjects(list, { needsInvoice: "unsent" });
    expect(sorted.map((p) => p.id)).toEqual(["needsInvoice", "active"]);
  });

  it("ranks awaiting-payment above plain active work", () => {
    const list = [
      proj("active", "active", "2026-01-01T00:00:00Z"),
      proj("awaitingPayment", "completed", "2026-01-01T00:00:00Z"),
    ];
    const sorted = prioritizeProjects(list, { awaitingPayment: "invoiced" });
    expect(sorted.map((p) => p.id)).toEqual(["awaitingPayment", "active"]);
  });

  it("puts delivered/archived work with nothing money-actionable last", () => {
    const list = [
      proj("delivered", "completed", "2026-01-05T00:00:00Z"),
      proj("active", "active", "2026-01-01T00:00:00Z"),
    ];
    const sorted = prioritizeProjects(list, { delivered: "paid" });
    expect(sorted.map((p) => p.id)).toEqual(["active", "delivered"]);
  });

  it("breaks ties within a tier by most-recently-updated first", () => {
    const list = [
      proj("older", "active", "2026-01-01T00:00:00Z"),
      proj("newer", "active", "2026-01-10T00:00:00Z"),
    ];
    const sorted = prioritizeProjects(list, {});
    expect(sorted.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("treats an unsent invoice on in-progress work as not yet money-actionable (only delivered work needs an invoice)", () => {
    const list = [
      proj("active-unsent", "active", "2026-01-01T00:00:00Z"),
      proj("delivered-invoiced", "completed", "2026-01-01T00:00:00Z"),
    ];
    const sorted = prioritizeProjects(list, { "delivered-invoiced": "invoiced" });
    // awaiting-payment (tier 1) still outranks in-progress work (tier 2)
    expect(sorted.map((p) => p.id)).toEqual(["delivered-invoiced", "active-unsent"]);
  });

  it("fails closed: when moneyVisibleByProject is provided and a project is missing from it, money signals are ignored for that project", () => {
    const list = [
      proj("hiddenMoney", "completed", "2026-01-01T00:00:00Z"),
      proj("active", "active", "2026-01-02T00:00:00Z"),
    ];
    // "hiddenMoney" would be tier 0 (needs invoice) if money were visible,
    // but moneyVisibleByProject omits it -- so it falls to tier 3 (delivered).
    const sorted = prioritizeProjects(list, { hiddenMoney: "unsent" }, {});
    expect(sorted.map((p) => p.id)).toEqual(["active", "hiddenMoney"]);
  });

  it("does not mutate the input array", () => {
    const list = [proj("b", "active", "2026-01-01T00:00:00Z"), proj("a", "active", "2026-01-02T00:00:00Z")];
    const original = [...list];
    prioritizeProjects(list, {});
    expect(list).toEqual(original);
  });
});

describe("computeFolderCounts", () => {
  it("counts projects with no folder under 'unfiled'", () => {
    const projects = [
      { ...proj("a", "active", "2026-01-01T00:00:00Z"), studio_folder_id: null },
      { ...proj("b", "active", "2026-01-01T00:00:00Z"), studio_folder_id: undefined },
    ] as StudioProject[];
    expect(computeFolderCounts(projects)).toEqual({ unfiled: 2 });
  });

  it("buckets projects by their real studio_folder_id", () => {
    const projects = [
      { ...proj("a", "active", "2026-01-01T00:00:00Z"), studio_folder_id: "f1" },
      { ...proj("b", "active", "2026-01-01T00:00:00Z"), studio_folder_id: "f1" },
      { ...proj("c", "active", "2026-01-01T00:00:00Z"), studio_folder_id: "f2" },
    ] as StudioProject[];
    expect(computeFolderCounts(projects)).toEqual({ unfiled: 0, f1: 2, f2: 1 });
  });

  it("returns { unfiled: 0 } for an empty project list", () => {
    expect(computeFolderCounts([])).toEqual({ unfiled: 0 });
  });
});

describe("defaultVisibleProjectCount", () => {
  it("shows fewer on narrow/mobile widths", () => {
    expect(defaultVisibleProjectCount(320)).toBe(3);
    expect(defaultVisibleProjectCount(479)).toBe(3);
  });

  it("shows a middle count on tablet widths", () => {
    expect(defaultVisibleProjectCount(480)).toBe(4);
    expect(defaultVisibleProjectCount(767)).toBe(4);
  });

  it("shows the full desktop default at and above 768px", () => {
    expect(defaultVisibleProjectCount(768)).toBe(6);
    expect(defaultVisibleProjectCount(1440)).toBe(6);
  });
});
