import type { StudioProject } from "./studioCardHelpers";
import type { PayState, StudioFolder } from "./studioHome.types";

const isDelivered = (s?: string | null) => s === "completed" || s === "archived";

/**
 * Studio home's one prioritization function -- was previously inline and
 * partially duplicated between WorkHome.tsx (folder counts) and
 * StudioProjectsDashboard.tsx (a plain "most recent" sort). Every signal
 * used here is a real field already loaded by WorkHome's existing
 * fetchProjects()/invoice fetch -- no new query.
 *
 * Deliberately NOT included, and why: "unread activity" and "due tasks"
 * per project would need a per-project read (messages/project_tasks),
 * which this page never fetches today -- adding it here would be exactly
 * the N+1 this overhaul is supposed to avoid at Studio-home scale (100s
 * of projects). If that signal becomes genuinely needed, it belongs in a
 * single aggregate query (e.g. a materialized counts view or one grouped
 * RPC), not a per-row fetch from this list.
 *
 * Order, highest priority first:
 *   1. needs an invoice (money-actionable, delivered work with nothing
 *      sent yet)
 *   2. awaiting payment (invoice sent, not yet paid)
 *   3. active/in-progress status (real work happening now)
 *   4. everything else, by most-recently-updated
 *   5. delivered/archived, always last, also by most-recently-updated
 * Within a tier, ties break by updated_at descending.
 */
export function prioritizeProjects(
  projects: StudioProject[],
  invoicesByProject: Record<string, PayState> = {},
  moneyVisibleByProject?: Record<string, boolean>,
): StudioProject[] {
  const moneyVisible = (id: string) => (moneyVisibleByProject ? moneyVisibleByProject[id] ?? false : true);
  const pay = (id: string): PayState => invoicesByProject[id] ?? "unsent";

  const tierOf = (p: StudioProject): number => {
    const delivered = isDelivered(p.status);
    if (delivered && moneyVisible(p.id) && pay(p.id) === "unsent") return 0;
    if (moneyVisible(p.id) && pay(p.id) === "invoiced") return 1;
    if (!delivered) return 2;
    return 3;
  };

  return [...projects].sort((a, b) => {
    const t = tierOf(a) - tierOf(b);
    if (t !== 0) return t;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

/** Per-folder (and "unfiled") project counts -- moved from an inline IIFE
 *  in WorkHome.tsx so StudioFoldersBar's own tests can exercise it
 *  directly instead of only through the full page. */
export function computeFolderCounts(projects: StudioProject[]): Record<string, number> {
  const counts: Record<string, number> = { unfiled: 0 };
  for (const p of projects) {
    const key = p.studio_folder_id || "unfiled";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Default visible-row count for the Projects list before "See more" --
 *  matches the product brief's 4-6 desktop / fewer mobile guidance using
 *  a simple breakpoint read at call time (no ResizeObserver needed here,
 *  unlike the folder strip -- a row count doesn't need sub-pixel
 *  precision the way a single-line width measurement does). */
export function defaultVisibleProjectCount(viewportWidth: number): number {
  if (viewportWidth < 480) return 3;
  if (viewportWidth < 768) return 4;
  return 6;
}

export type { StudioFolder };
