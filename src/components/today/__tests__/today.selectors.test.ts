import { describe, it, expect, vi } from "vitest";
import { derivePrimaryCta } from "../today.selectors";
import type { MomentumData, PassportReadiness, PriorityAction, StampsSignal } from "../today.types";

// today.selectors.ts imports the real supabase client at module scope;
// derivePrimaryCta itself is a pure function that never touches it, but the
// import still needs a client that constructs without throwing in a test
// environment with no .env.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

/**
 * Pure-function coverage for the adaptive primary CTA -- the one piece of
 * Today's priority logic that's meaningfully unit-testable without mounting
 * the full dashboard tree (which pulls in ~15 live-data sub-widgets). Each
 * case matches a row from the product brief's own priority table.
 */

const NONE: PriorityAction = { kind: "none" };
const NO_STAMPS: StampsSignal = { waitingForCoSign: 0 };
const NO_MOMENTUM: MomentumData = { completedThisWeek: 0, activeProjects: [], nextMilestone: null, signals: [] };

describe("derivePrimaryCta", () => {
  it("new user with no Passport data at all -> Build my Passport", () => {
    const cta = derivePrimaryCta({ priority: NONE, passport: null, stamps: null, momentum: null, approvalCount: 0 });
    expect(cta).toEqual({ label: "Build my Passport", href: "/passport" });
  });

  it("Passport at 0% -> Build my Passport", () => {
    const passport: PassportReadiness = { percentage: 0, missingFields: ["Full Name"], isComplete: false };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps: null, momentum: null, approvalCount: 0 });
    expect(cta).toEqual({ label: "Build my Passport", href: "/passport" });
  });

  it("Passport incomplete but started -> Complete my Passport", () => {
    const passport: PassportReadiness = { percentage: 60, missingFields: ["Bio"], isComplete: false };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps: null, momentum: null, approvalCount: 0 });
    expect(cta).toEqual({ label: "Complete my Passport", href: "/passport" });
  });

  it("Passport complete + credits waiting for co-sign -> Send co-sign requests", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const stamps: StampsSignal = { waitingForCoSign: 2 };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps, momentum: null, approvalCount: 0 });
    expect(cta).toEqual({ label: "Send co-sign requests", href: "/credits" });
  });

  it("pending Kreto proposal outranks a plain approval count -> Review Kreto's suggestion", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const priority: PriorityAction = { kind: "approval", approval: { id: "a1", title: "Draft outreach", body: "...", href: "/desk/p1" } };
    const cta = derivePrimaryCta({ priority, passport, stamps: NO_STAMPS, momentum: null, approvalCount: 3 });
    expect(cta).toEqual({ label: "Review Kreto's suggestion", href: "/desk/p1" });
  });

  it("no priority action but approvals pending -> Review pending approvals", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps: NO_STAMPS, momentum: null, approvalCount: 1 });
    expect(cta).toEqual({ label: "Review pending approvals", href: "/desk" });
  });

  it("active Studio project with a task-due signal -> Open Studio, using that signal's own href", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const momentum: MomentumData = {
      ...NO_MOMENTUM,
      activeProjects: [{ id: "p1", title: "Bali Carnival", status: "active" }],
      signals: [{ id: "studio-p1", icon: "task", text: "Bali Carnival has 3 tasks due this week", ctaLabel: "Open Studio", href: "/desk/p1" }],
    };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps: NO_STAMPS, momentum, approvalCount: 0 });
    expect(cta).toEqual({ label: "Open Studio", href: "/desk/p1" });
  });

  it("fresh Scout gig as the only signal -> Review Calls", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const priority: PriorityAction = { kind: "gig", gig: { id: "g1", title: "Music video editor", company: "Indie label" } };
    const cta = derivePrimaryCta({ priority, passport, stamps: NO_STAMPS, momentum: NO_MOMENTUM, approvalCount: 0 });
    expect(cta).toEqual({ label: "Review Calls", href: "/scout" });
  });

  it("fully caught-up user with nothing pending -> Ask Kreto, never a dead end", () => {
    const passport: PassportReadiness = { percentage: 100, missingFields: [], isComplete: true };
    const cta = derivePrimaryCta({ priority: NONE, passport, stamps: NO_STAMPS, momentum: NO_MOMENTUM, approvalCount: 0 });
    expect(cta).toEqual({ label: "Ask Kreto", event: "thrive-copilot:open" });
  });
});
