import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudioPulse } from "../StudioPulse";

/**
 * StudioPulse is the merged Session & Activity + Casting & Collaborators
 * surface -- its own job is composition, live/empty-state messaging, and
 * the crew CTA, NOT re-implementing any of its child widgets' real data
 * fetching (each already has its own fetch/realtime/self-hiding behavior,
 * untouched by this overhaul). So every child that talks to Supabase is
 * replaced with a thin, controllable stub here; what's under test is what
 * StudioPulse itself does with the signals those children report back.
 */

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), liveCount: null as number | null }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

vi.mock("@/components/circle/SoundStagesRail", () => ({
  SoundStagesRail: ({ onLoad }: { onLoad?: (n: number) => void }) => {
    useEffect(() => {
      if (mocks.liveCount !== null) onLoad?.(mocks.liveCount);
    }, [onLoad]);
    return <div data-testid="sound-stages-rail" />;
  },
}));
vi.mock("@/components/home/SpeedTonightCard", () => ({
  SpeedTonightCard: () => <div data-testid="speed-tonight-card" />,
}));
vi.mock("@/components/desk/TodayStrip", () => ({
  TodayStrip: () => <div data-testid="today-strip" />,
}));
vi.mock("@/components/project/MyPendingInvitations", () => ({
  MyPendingInvitations: () => <div data-testid="pending-invitations" />,
}));
vi.mock("@/components/opportunity/CastingCallsRail", () => ({
  CastingCallsRail: () => <div data-testid="casting-calls-rail" />,
}));
vi.mock("@/components/calls/RecentRecordingsRail", () => ({
  RecentRecordingsRail: () => <div data-testid="recent-recordings-rail" />,
}));

beforeEach(() => {
  // jsdom has neither observer; the real (unmocked) crew carousel uses
  // embla-carousel, which requires both to initialize at all.
  // @ts-expect-error -- minimal stubs, only existence is required here.
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const baseProps = { onVoice: vi.fn(), onCommandPalette: vi.fn(), onWrapWeek: vi.fn() };

const renderPulse = (recentCollaborators: { id: string; full_name: string; avatar_url: string | null; role: string | null }[] = []) =>
  render(
    <MemoryRouter>
      <StudioPulse recentCollaborators={recentCollaborators} {...baseProps} />
    </MemoryRouter>,
  );

describe("StudioPulse", () => {
  beforeEach(() => {
    mocks.liveCount = null;
    mocks.navigate.mockClear();
  });

  it("says nothing about live status before the real session count is known -- no fake 'live' claim while loading", () => {
    renderPulse(); // liveCount stays null -- SoundStagesRail never calls onLoad
    expect(screen.queryByText(/No live Sound Stage right now/)).not.toBeInTheDocument();
    expect(screen.queryByText(/live now/i)).not.toBeInTheDocument();
  });

  it("shows the real 'no live session' message only once the count is known to be zero", () => {
    mocks.liveCount = 0;
    renderPulse();
    expect(screen.getByText("No live Sound Stage right now.")).toBeInTheDocument();
  });

  it("shows no 'no live session' message when a real live session exists", () => {
    mocks.liveCount = 3;
    renderPulse();
    expect(screen.queryByText(/No live Sound Stage right now/)).not.toBeInTheDocument();
  });

  it("renders a compact 'build your crew' empty state with a working CTA when there are no collaborators yet", () => {
    renderPulse([]);
    expect(screen.getByText("Build your crew for this Studio.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Invite/ }));
    expect(mocks.navigate).toHaveBeenCalledWith("/post-opportunity");
  });

  it("shows real collaborators instead of the empty state when there are some, and navigates to their real profile", () => {
    renderPulse([{ id: "c1", full_name: "Maya Chen", avatar_url: null, role: "Editor" }]);
    expect(screen.queryByText("Build your crew for this Studio.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Maya Chen"));
    expect(mocks.navigate).toHaveBeenCalledWith("/profile/c1");
  });

  it("renders the recent-activity and contextual-action sub-widgets without reimplementing them", () => {
    renderPulse();
    expect(screen.getByTestId("recent-recordings-rail")).toBeInTheDocument();
    expect(screen.getByTestId("pending-invitations")).toBeInTheDocument();
    expect(screen.getByTestId("casting-calls-rail")).toBeInTheDocument();
    expect(screen.getByTestId("today-strip")).toBeInTheDocument();
    expect(screen.getByTestId("speed-tonight-card")).toBeInTheDocument();
  });

  it("labels the primary live section as 'Right now', not a generic/duplicate heading", () => {
    renderPulse();
    expect(screen.getByRole("heading", { name: "Right now" })).toBeInTheDocument();
  });
});
