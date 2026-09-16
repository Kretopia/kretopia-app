import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import { StudioFoldersBar } from "../StudioFoldersBar";
import type { StudioFolder } from "../studioHome.types";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

/**
 * Regression coverage for the responsive one-line folder strip. jsdom does
 * no real layout, so `getBoundingClientRect` is stubbed to return known
 * widths for each measured element (matched by its rendered text, since
 * that's stable regardless of internal DOM structure) -- this exercises
 * the *real* fit-count algorithm in StudioFoldersBar with deterministic
 * inputs, rather than asserting on its internals directly.
 *
 * Every folder chip is intentionally rendered twice: once in the real
 * visible strip, once more in the off-screen `aria-hidden` measuring row
 * the component uses to read each chip's natural width. So every query
 * below is scoped to the visible strip specifically (`#studio-folders-strip`),
 * not `screen` directly -- otherwise a folder name matches both copies.
 */

const folders = (n: number): StudioFolder[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `f${i + 1}`,
    name: `Folder ${String.fromCharCode(65 + i)}`, // Folder A, B, C...
    color: "teal",
    sort_order: i,
  }));

const WIDTH = { strip: 0, all: 68, unfiled: 78, newFolder: 98, chip: 98, toggle: 118 };

function stubMeasurements(stripWidth: number) {
  WIDTH.strip = stripWidth;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const text = (this.textContent || "").trim();
    let width = 0;
    if (this.id === "studio-folders-strip") width = WIDTH.strip;
    else if (text === "New folder") width = WIDTH.newFolder - 8;
    else if (/more folders|All folders/i.test(text)) width = WIDTH.toggle - 8;
    else if (text.startsWith("All")) width = WIDTH.all - 8;
    else if (text.startsWith("Unfiled")) width = WIDTH.unfiled - 8;
    else if (text.startsWith("Folder ")) width = WIDTH.chip - 8;
    return {
      width, height: 32, top: 0, left: 0, right: width, bottom: 32, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

beforeEach(() => {
  // jsdom has no real ResizeObserver; recompute() runs synchronously on
  // mount regardless, so a no-op stub is sufficient.
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  userId: "u1",
  counts: {},
  selected: "all",
  onSelect: vi.fn(),
  onChanged: vi.fn(),
};

function renderStrip(props: Partial<React.ComponentProps<typeof StudioFoldersBar>> = {}) {
  const { container } = render(<StudioFoldersBar {...baseProps} folders={folders(5)} {...props} />);
  const strip = container.querySelector("#studio-folders-strip") as HTMLElement;
  return { strip, visible: within(strip) };
}

describe("StudioFoldersBar — responsive overflow", () => {
  it("shows every folder with no overflow toggle when they all fit on one line", () => {
    stubMeasurements(2000); // generous width -- everything fits
    const { visible } = renderStrip();
    for (const f of folders(5)) expect(visible.getByText(f.name)).toBeInTheDocument();
    expect(visible.queryByRole("button", { name: /more folders/i })).not.toBeInTheDocument();
  });

  it("hides overflowing folders behind a 'See N more folders' control sized to the real strip width", () => {
    stubMeasurements(700); // fits ~3 of 5 folder chips alongside All/Unfiled/New folder
    const { visible } = renderStrip();
    const toggle = visible.getByRole("button", { name: "See 2 more folders" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "studio-folders-strip");
    expect(visible.getByText("Folder A")).toBeInTheDocument();
    expect(visible.queryByText("Folder E")).not.toBeInTheDocument();
  });

  it("expand reveals every hidden folder and collapse (Show less) returns to the fitted subset", () => {
    stubMeasurements(700);
    const { visible } = renderStrip();
    const toggle = visible.getByRole("button", { name: "See 2 more folders" });
    fireEvent.click(toggle);
    expect(visible.getByText("Folder E")).toBeInTheDocument();
    const collapse = visible.getByRole("button", { name: "Show less" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(collapse);
    expect(visible.queryByText("Folder E")).not.toBeInTheDocument();
  });

  it("never hides the currently-selected folder behind 'See more', even when it would otherwise overflow", () => {
    stubMeasurements(700); // only ~3 of 5 chips would naturally fit
    const { visible } = renderStrip({ selected: "f5" });
    // Folder E (f5) is selected -- must be visible without expanding.
    expect(visible.getByText("Folder E")).toBeInTheDocument();
  });

  it("always keeps All and Unfiled visible regardless of folder count", () => {
    stubMeasurements(300); // very tight -- barely room for one chip
    const { visible } = renderStrip({ folders: folders(6) });
    expect(visible.getByText(/^All/)).toBeInTheDocument();
    expect(visible.getByText(/^Unfiled/)).toBeInTheDocument();
  });
});
