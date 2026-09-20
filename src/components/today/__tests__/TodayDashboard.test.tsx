import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TodayDashboard } from "../TodayDashboard";
import type { ProfileRow } from "../today.types";

/**
 * Regression coverage for the Passport-dashboard toggle added when the old
 * standalone /dashboard page's content moved into Today: it must render
 * collapsed by default (Today's own job -- "what should I do now" -- comes
 * first) and only mount the (lazy) metrics dashboard once actually opened.
 */

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("../today.selectors", () => ({
  useTodaySignals: () => ({
    loading: false,
    error: null,
    isNewUser: false,
    priority: { kind: "none" },
    primaryCta: { label: "Ask Kreto", event: "thrive-copilot:open" },
    passport: null,
    stamps: null,
    momentum: null,
    approvalCount: 0,
    deadlines: [],
    unreadMessages: 0,
    reload: vi.fn(),
  }),
}));
vi.mock("../TodayCommandCenter", () => ({ TodayCommandCenter: () => <div data-testid="command-center" /> }));
vi.mock("../TodayOpportunities", () => ({ TodayOpportunities: () => <div data-testid="opportunities" /> }));
vi.mock("../TodayMetricsDashboard", () => ({
  TodayMetricsDashboard: () => <div data-testid="metrics-dashboard">Passport metrics</div>,
}));

const profile = { user_id: "u1", full_name: "Maya" } as unknown as ProfileRow;

describe("TodayDashboard — Passport dashboard toggle", () => {
  it("renders the toggle collapsed by default, without mounting the metrics dashboard", () => {
    render(
      <MemoryRouter>
        <TodayDashboard profileFull={profile} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Your Passport dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("metrics-dashboard")).not.toBeInTheDocument();
  });

  it("mounts the metrics dashboard once the toggle is clicked", async () => {
    render(
      <MemoryRouter>
        <TodayDashboard profileFull={profile} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Your Passport dashboard"));
    await waitFor(() => expect(screen.getByTestId("metrics-dashboard")).toBeInTheDocument());
  });
});
