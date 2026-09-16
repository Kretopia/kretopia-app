import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StudioProjectsDashboard } from "../StudioProjectsDashboard";

// Only useNavigate is overridden (to capture its call args) -- everything
// else, including MemoryRouter and real route matching, is untouched.
const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const projects = [
  { id: "a", title: "Carnival Film", status: "active", updated_at: new Date().toISOString(), client_name: "Spice House" },
  { id: "b", title: "Album Rollout", status: "completed", updated_at: new Date().toISOString(), client_name: null },
];

const renderDash = (props: Partial<React.ComponentProps<typeof StudioProjectsDashboard>> = {}) =>
  render(
    <MemoryRouter>
      <StudioProjectsDashboard
        projects={projects as any}
        invoicesByProject={{ a: "invoiced", b: "unsent" }}
        onCreate={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

describe("StudioProjectsDashboard", () => {
  it("uses Projects terminology and never says 'Loose'", () => {
    const { container } = renderDash();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain("loose");
  });

  it("renders both projects with a next action", () => {
    renderDash();
    expect(screen.getByText("Carnival Film")).toBeInTheDocument();
    expect(screen.getByText("Album Rollout")).toBeInTheDocument();
    expect(screen.getAllByText(/^Next:/).length).toBe(2);
  });

  it("filters via the summary tiles", () => {
    renderDash();
    fireEvent.click(screen.getByRole("button", { name: "Filter by In progress" }));
    expect(screen.getByText("Carnival Film")).toBeInTheDocument();
    expect(screen.queryByText("Album Rollout")).not.toBeInTheDocument();
  });

  it("searches by title", () => {
    renderDash();
    fireEvent.change(screen.getByLabelText("Search Projects"), { target: { value: "album" } });
    expect(screen.queryByText("Carnival Film")).not.toBeInTheDocument();
    expect(screen.getByText("Album Rollout")).toBeInTheDocument();
  });

  it("hides every money signal when the viewer may not see money", () => {
    const { container } = renderDash({ canSeeMoney: false });
    expect(container.textContent).not.toContain("Awaiting payment");
    expect(container.textContent).not.toContain("Invoiced");
    expect(container.textContent).not.toContain("Draft the invoice");
  });

  it("gates money per-project when moneyVisibleByProject is provided, not globally", () => {
    // "a" (Carnival Film) is owner-visible, "b" (Album Rollout) is not --
    // this is the real shape of a viewer's dashboard mixing roles across
    // Projects, which a single canSeeMoney boolean can't express.
    renderDash({ canSeeMoney: true, moneyVisibleByProject: { a: true, b: false } });
    const carnivalRow = screen.getByText("Carnival Film").closest("li")!;
    const albumRow = screen.getByText("Album Rollout").closest("li")!;
    expect(carnivalRow.textContent).toContain("Invoiced");
    expect(albumRow.textContent).not.toContain("No invoice");
    expect(albumRow.textContent).not.toContain("Invoiced");
  });

  it("treats a project missing from moneyVisibleByProject as not visible (fails closed)", () => {
    renderDash({ moneyVisibleByProject: { a: true } }); // "b" intentionally absent
    const albumRow = screen.getByText("Album Rollout").closest("li")!;
    expect(albumRow.textContent).not.toContain("No invoice");
    expect(albumRow.textContent).toContain("Review the delivery");
  });

  it("shows a creation-led empty state with no dead end", () => {
    renderDash({ projects: [] });
    expect(screen.getByText("No Projects yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create your first Project/i })).toBeInTheDocument();
  });

  it("renders loading and error states", () => {
    renderDash({ loading: true });
    expect(screen.getByText(/Loading your Projects/)).toBeInTheDocument();
    renderDash({ error: "network down" });
    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("navigates to the Project on row click, using its real id", () => {
    renderDash();
    fireEvent.click(screen.getByText("Carnival Film"));
    expect(mocks.navigate).toHaveBeenCalledWith("/desk/a");
  });
});

describe("StudioProjectsDashboard scalability (default subset + expand/collapse)", () => {
  afterEach(() => {
    mocks.navigate.mockClear();
    // Restore jsdom's default viewport between tests.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
  });

  const manyProjects = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      title: `Project ${i}`,
      status: i === 0 ? "completed" : "active", // p0 is the one money-actionable row
      updated_at: new Date(2026, 0, i + 1).toISOString(),
      client_name: null,
    }));

  it("caps the default list to defaultVisibleProjectCount for the current viewport, not every matching row", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard
          projects={list as any}
          invoicesByProject={{ p0: "unsent" }}
          onCreate={vi.fn()}
        />
      </MemoryRouter>,
    );
    // Desktop default is 6 -- summary line and rendered rows must agree.
    expect(screen.getByText("6 of 9 shown")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBe(6);
  });

  it("shows a narrower default subset on a mobile-width viewport", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 375 });
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={list as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("3 of 9 shown")).toBeInTheDocument();
  });

  it("prioritizes the money-actionable project into the default subset even when it's the oldest row", () => {
    // p0 is "completed" + unsent invoice (tier 0, needs an invoice) but has
    // the OLDEST updated_at of the set -- a plain recency sort would push
    // it past the default cap of 6 out of 9; real prioritization must not.
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard
          projects={list as any}
          invoicesByProject={{ p0: "unsent" }}
          onCreate={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Project 0")).toBeInTheDocument();
  });

  it("shows 'See all N projects' only when rows are actually hidden, not for a short list", () => {
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={projects as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/See all/)).not.toBeInTheDocument();
  });

  it("expand reveals every row and collapse (Show fewer) returns to the default subset", () => {
    const list = manyProjects(9);
    render(
      <MemoryRouter>
        <StudioProjectsDashboard projects={list as any} onCreate={vi.fn()} />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "See all 9 projects" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(screen.getAllByRole("listitem").length).toBe(9);
    const collapse = screen.getByRole("button", { name: "Show fewer" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapse);
    expect(screen.getAllByRole("listitem").length).toBe(6);
  });
});
