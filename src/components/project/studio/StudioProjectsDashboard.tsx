import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Search, ChevronRight, AlertTriangle, FolderInput, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { BrandLoader } from "@/components/brand/BrandDots";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { moodAccent, monogram, STATUS_PILL, PAY_DOT, PAY_LABEL, type StudioProject } from "./studioCardHelpers";
import { MoveToFolderSheet } from "./MoveToFolderSheet";
import { StudioOverflowToggle } from "./StudioOverflowToggle";
import { prioritizeProjects, defaultVisibleProjectCount } from "./studioHome.selectors";
import type { StudioFolder } from "./studioHome.types";

type PayState = "paid" | "invoiced" | "unsent";
type StatusFilter = "all" | "active" | "needs_invoice" | "awaiting_payment" | "delivered";
type SortKey = "recent" | "title" | "status";

interface StudioProjectsDashboardProps {
  projects: StudioProject[];
  /** Invoice state per project. Owner-scoped: only pass this when the viewer may see money. */
  invoicesByProject?: Record<string, PayState>;
  /** Global fallback used only when moneyVisibleByProject isn't provided
   * (existing callers that haven't opted into per-row role checks). */
  canSeeMoney?: boolean;
  /** Per-project role check (from can_see_milestone_money): owner/creative/
   * collaborator see money, client/guest don't. This list mixes Projects
   * across different roles for the same viewer, so a single global
   * canSeeMoney flag can't correctly gate it -- when this map is provided,
   * an id missing from it is treated as NOT visible (fail closed), not as
   * visible by default. */
  moneyVisibleByProject?: Record<string, boolean>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate: () => void;
  folders?: StudioFolder[];
  onMoveToFolder?: (projectId: string, folderId: string | null) => void;
}

const STATUS_RANK: Record<string, number> = { active: 0, planning: 1, wrapping: 2, completed: 3, archived: 4 };
const isDelivered = (s?: string | null) => s === "completed" || s === "archived";

/**
 * Projects dashboard — one prioritized list with a summary strip,
 * search, filter and sort. Replaces the previous card wall. Every number
 * here is computed from data already loaded on this page (projects rows +
 * the invoice-status map); nothing is estimated or invented.
 */
export const StudioProjectsDashboard = ({
  projects,
  invoicesByProject = {},
  canSeeMoney = true,
  moneyVisibleByProject,
  loading = false,
  error = null,
  onRetry,
  onCreate,
  folders = [],
  onMoveToFolder,
}: StudioProjectsDashboardProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [moveTarget, setMoveTarget] = useState<StudioProject | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pay = (id: string): PayState => invoicesByProject[id] ?? "unsent";
  // Per-project gate: prefer the role-checked map when the caller opted
  // in; otherwise fall back to the single global flag for every row.
  const moneyVisible = (id: string): boolean =>
    moneyVisibleByProject ? (moneyVisibleByProject[id] ?? false) : canSeeMoney;
  const anyMoneyVisible = moneyVisibleByProject
    ? Object.values(moneyVisibleByProject).some(Boolean)
    : canSeeMoney;

  const counts = useMemo(() => {
    const active = projects.filter((p) => !isDelivered(p.status)).length;
    const delivered = projects.filter((p) => isDelivered(p.status)).length;
    const moneyProjects = projects.filter((p) => moneyVisible(p.id));
    const needsInvoice = moneyProjects.filter((p) => isDelivered(p.status) && pay(p.id) === "unsent").length;
    const awaitingPayment = moneyProjects.filter((p) => pay(p.id) === "invoiced").length;
    return { active, delivered, needsInvoice, awaitingPayment };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, invoicesByProject, moneyVisibleByProject, canSeeMoney]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (q && !`${p.title} ${p.client_name ?? ""}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "active": return !isDelivered(p.status);
        case "delivered": return isDelivered(p.status);
        case "needs_invoice": return isDelivered(p.status) && pay(p.id) === "unsent";
        case "awaiting_payment": return pay(p.id) === "invoiced";
        default: return true;
      }
    });
    if (sort === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "status") {
      list = [...list].sort((a, b) => {
        const d = (STATUS_RANK[a.status ?? "active"] ?? 1) - (STATUS_RANK[b.status ?? "active"] ?? 1);
        return d !== 0 ? d : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    } else {
      // "recent" -- the default -- is real prioritization, not just
      // most-recently-updated: money-actionable and in-progress work
      // outranks delivered/archived, centralized in studioHome.selectors
      // so this ordering isn't duplicated anywhere else on Studio home.
      list = prioritizeProjects(list, invoicesByProject, moneyVisibleByProject);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, invoicesByProject, moneyVisibleByProject, query, filter, sort]);

  const visibleCount = expanded ? rows.length : Math.min(rows.length, defaultVisibleProjectCount(viewportWidth));
  const visibleRows = rows.slice(0, visibleCount);
  const hiddenRowCount = rows.length - visibleRows.length;

  /** Next action — derived only from status + invoice state, both real fields. */
  const nextAction = (p: StudioProject) => {
    if (!isDelivered(p.status)) {
      if (p.status === "wrapping") return "Wrap it up";
      if (p.status === "planning") return "Add the first tasks";
      return "Open the work feed";
    }
    if (!moneyVisible(p.id)) return "Review the delivery";
    const state = pay(p.id);
    if (state === "unsent") return "Draft the invoice";
    if (state === "invoiced") return "Chase the payment";
    return "Log the credits";
  };

  const TILES: { key: StatusFilter; label: string; value: number; money?: boolean }[] = [
    { key: "active", label: "In progress", value: counts.active },
    { key: "needs_invoice", label: "Needs an invoice", value: counts.needsInvoice, money: true },
    { key: "awaiting_payment", label: "Awaiting payment", value: counts.awaitingPayment, money: true },
    { key: "delivered", label: "Delivered", value: counts.delivered },
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <BrandLoader fullscreen={false} size="sm" className="mx-auto mb-2" />
        Loading your Projects…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-destructive" aria-hidden />
        <p className="text-sm font-semibold">We couldn't load your Projects.</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
        )}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
        <h3 className="text-base font-bold">No Projects yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          A Project keeps the brief, the work, the people and the proof of what happened in
          one place. Start with what you're making.
        </p>
        <div className="mt-5 flex justify-center">
          <CtaButton onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Create your first Project
          </CtaButton>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="studio-projects-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="studio-projects-title" className="text-base font-bold">Projects</h2>
        <span className="text-xs text-muted-foreground">
          {visibleRows.length} of {projects.length} shown
        </span>
      </div>

      {/* Summary strip — clicking a tile filters the list below. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.filter((t) => anyMoneyVisible || !t.money).map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              aria-label={`Filter by ${t.label}`}
              onClick={() => setFilter(active ? "all" : t.key)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:border-primary/30",
              )}
            >
              <p className="text-2xl font-black tabular-nums leading-none">{t.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Projects"
            aria-label="Search Projects"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-44" aria-label="Sort Projects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Latest activity</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="title">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Priority list -- capped to a curated top slice by default
          (defaultVisibleProjectCount, viewport-aware) rather than every
          matching row; "See N more" reveals the rest without a second
          fetch, since `rows` already holds the full prioritized/filtered
          set in memory. */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No Projects match this view.{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => { setFilter("all"); setQuery(""); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul id="studio-projects-list" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {visibleRows.map((p) => {
            const pill = STATUS_PILL[p.status ?? "active"] ?? STATUS_PILL.planning;
            const state = pay(p.id);
            return (
              <li key={p.id} className="group relative flex items-center gap-3 p-3 sm:p-4 hover:bg-accent/40">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black text-black"
                  style={{ background: moodAccent(p.mood) }}
                >
                  {monogram(p.title)}
                </span>

                <button
                  type="button"
                  onClick={() => navigate(`/desk/${p.id}`)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{p.title}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", pill.tone)}>
                      {pill.label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.client_name || p.description || "No client set"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Updated {formatDistanceToNowStrict(new Date(p.updated_at))} ago</span>
                    {moneyVisible(p.id) && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", PAY_DOT[state])} aria-hidden />
                        {PAY_LABEL[state]}
                      </span>
                    )}
                    <span className="font-semibold text-foreground/80">Next: {nextAction(p)}</span>
                  </div>
                </button>

                {onMoveToFolder && folders.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Move ${p.title} to a folder`}
                    onClick={() => setMoveTarget(p)}
                  >
                    <FolderInput className="h-4 w-4" />
                  </Button>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </li>
            );
          })}
        </ul>
      )}

      {(hiddenRowCount > 0 || expanded) && rows.length > 0 && (
        <div className="flex justify-center">
          <StudioOverflowToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            itemLabel="project"
            expandLabel={expanded ? undefined : `See all ${rows.length} projects`}
            collapseLabel="Show fewer"
            controlsId="studio-projects-list"
          />
        </div>
      )}

      {onMoveToFolder && (
        <MoveToFolderSheet
          open={!!moveTarget}
          onOpenChange={(v) => !v && setMoveTarget(null)}
          folders={folders}
          currentFolderId={moveTarget?.studio_folder_id ?? null}
          projectTitle={moveTarget?.title}
          onMove={(folderId) => {
            if (moveTarget) onMoveToFolder(moveTarget.id, folderId);
            setMoveTarget(null);
          }}
        />
      )}
    </section>
  );
};

export default StudioProjectsDashboard;
