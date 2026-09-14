import { useState, useEffect, useMemo } from "react";
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, FolderKanban, Plus, Search, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MyPendingInvitations } from "@/components/project/MyPendingInvitations";
import { StudioCardsGrid } from "@/components/project/studio/StudioCardsGrid";
import { VoiceFirstCreateModal } from "@/components/project/studio/VoiceFirstCreateModal";
import { StudioFoldersBar, type StudioFolder } from "@/components/project/studio/StudioFoldersBar";
import { PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS } from "@/lib/projectColumns";

const ProjectsList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [invoicesByProject, setInvoicesByProject] = useState<
    Record<string, "paid" | "invoiced" | "unsent">
  >({});
  const [moneyVisibleByProject, setMoneyVisibleByProject] = useState<Record<string, boolean>>({});
  const [showVoiceCreate, setShowVoiceCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "planning" | "wrapping" | "completed">("all");
  const [payFilter, setPayFilter] = useState<"all" | "unsent" | "invoiced" | "paid">("all");
  const [folders, setFolders] = useState<StudioFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all"); // "all" | "unfiled" | folder id

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("studio_folders")
      .select("id, name, color, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setFolders((data as StudioFolder[]) || []);
  };

  const moveProjectToFolder = async (projectId: string, folderId: string | null) => {
    const prev = projects;
    setProjects((p) => p.map((pr) => (pr.id === projectId ? { ...pr, studio_folder_id: folderId } : pr)));
    const { error } = await supabase
      .from("projects")
      .update({ studio_folder_id: folderId })
      .eq("id", projectId);
    if (error) {
      setProjects(prev);
      toast({ title: "Couldn't move project", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchFolders();
      const trackPage = async () => {
        const { analytics } = await import("@/lib/analytics");
        analytics.pageView("projects_list");
      };
      trackPage();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // Explicit column list, not "*": client_price/creative_payout/
      // margin_type/margin_value are permanently locked down and a
      // wildcard select fails the whole query with 42501 for every
      // caller -- see src/lib/projectColumns.ts.
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const list = projectsData || [];
      setProjects(list);

      // Best-effort: classify each project's invoice status for the payment dot
      if (list.length) {
        const ids = list.map((p) => p.id);
        const { data: invs } = await supabase
          .from("invoices")
          .select("project_id, status")
          .in("project_id", ids);
        const map: Record<string, "paid" | "invoiced" | "unsent"> = {};
        for (const id of ids) map[id] = "unsent";
        for (const row of invs || []) {
          const cur = map[row.project_id];
          if (row.status === "paid") map[row.project_id] = "paid";
          else if (cur !== "paid") map[row.project_id] = "invoiced";
        }
        setInvoicesByProject(map);

        // Per-project money visibility (owner/creative/collaborator see the
        // pay dot; clients and guests don't). Without this the grid fails
        // closed and no dot renders at all.
        if (user?.id) {
          const visible: Record<string, boolean> = {};
          await Promise.all(
            ids.map(async (id) => {
              const { data } = await supabase
                .rpc("can_see_milestone_money", { _project_id: id, _user_id: user.id })
                .then((r) => r, () => ({ data: false }));
              visible[id] = Boolean(data);
            }),
          );
          setMoneyVisibleByProject(visible);
        }
      }
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeCount = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (payFilter !== "all" && (invoicesByProject[p.id] ?? "unsent") !== payFilter) return false;
      if (folderFilter === "unfiled" && p.studio_folder_id) return false;
      if (folderFilter !== "all" && folderFilter !== "unfiled" && p.studio_folder_id !== folderFilter) return false;
      if (q) {
        const hay = `${p.title ?? ""} ${p.client_name ?? ""} ${p.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, query, statusFilter, payFilter, folderFilter, invoicesByProject]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { unfiled: 0 };
    for (const p of projects) {
      const key = p.studio_folder_id || "unfiled";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [projects]);

  const filtersActive =
    query.trim() !== "" || statusFilter !== "all" || payFilter !== "all" || folderFilter !== "all";

  if (loading) {
    return (
      <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6 pb-32 md:pb-12">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-36 rounded bg-muted animate-pulse" />
        </div>
        {/* Stat chips skeleton */}
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[78px] min-w-[136px] rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-muted animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const STATUS_CHIPS: { id: typeof statusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "In progress" },
    { id: "planning", label: "Planning" },
    { id: "wrapping", label: "Wrapping" },
    { id: "completed", label: "Delivered" },
  ];
  const PAY_CHIPS: { id: typeof payFilter; label: string; dot: string }[] = [
    { id: "unsent", label: "No invoice", dot: "bg-[hsl(var(--energy))]" },
    { id: "invoiced", label: "Invoiced", dot: "bg-[hsl(var(--signal-amber))]" },
    { id: "paid", label: "Paid", dot: "bg-[hsl(var(--accent-pay))]" },
  ];



  return (
    <div className="accent-studios container max-w-6xl mx-auto py-3 sm:py-4 px-3 sm:px-4 space-y-3 sm:space-y-4 pb-32 md:pb-12 overflow-y-auto">
      {/* Header — lite, single line */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderKanban className="h-4 w-4 text-[hsl(var(--signal-teal))] shrink-0" />
          <h1 className="text-xl font-black tracking-[-0.03em] truncate">
            <span className="italic text-[hsl(var(--signal-teal))]">Studios</span>
          </h1>
          {projects.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">
              · {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/studio/import")}
            className="h-8 gap-1.5 rounded-full text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Import
          </Button>
        </div>
      </header>

      {/* Pending Invitations (only if any) */}
      <MyPendingInvitations />

      {/* Folders bar (always visible when there's at least one project) */}
      {user && projects.length > 0 && (
        <StudioFoldersBar
          userId={user.id}
          folders={folders}
          counts={folderCounts}
          selected={folderFilter}
          onSelect={setFolderFilter}
          onChanged={fetchFolders}
        />
      )}

      {/* Search + quick filters (only when there's something to search) */}
      {projects.length > 2 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rooms, clients, briefs…"
              className="pl-9 pr-9 h-10 rounded-full bg-muted/40 border-border/60"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setStatusFilter(c.id)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border",
                  statusFilter === c.id
                    ? "bg-background text-[hsl(var(--signal-teal))] border-[hsl(var(--signal-teal))]/40 ring-1 ring-[hsl(var(--signal-teal))]/20 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {c.label}
              </button>
            ))}
            <span className="shrink-0 h-4 w-px bg-border mx-1" />
            {PAY_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setPayFilter(payFilter === c.id ? "all" : c.id)}
                className={cn(
                  "shrink-0 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors border inline-flex items-center gap-1.5",
                  payFilter === c.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
                {c.label}
              </button>
            ))}
            {filtersActive && (
              <button
                onClick={() => { setQuery(""); setStatusFilter("all"); setPayFilter("all"); setFolderFilter("all"); }}
                className="shrink-0 h-7 px-2.5 rounded-full text-[11px] font-semibold text-white/60 hover:text-[hsl(var(--energy))] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Studio Cards grid (or empty state) */}
      {filtersActive && filteredProjects.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm font-semibold mb-1">No rooms match those filters</p>
          <p className="text-xs text-muted-foreground mb-4">Try a different search or clear the filters.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setQuery(""); setStatusFilter("all"); setPayFilter("all"); setFolderFilter("all"); }}
          >
            Clear filters
          </Button>
        </Card>
      ) : (
        <StudioCardsGrid
          projects={filteredProjects as any}
          invoicesByProject={invoicesByProject}
          moneyVisibleByProject={moneyVisibleByProject}
          onNewProject={() => setShowVoiceCreate(true)}
          folders={folders}
          onMoveToFolder={moveProjectToFolder}
        />
      )}

      {/* Floating New Project FAB */}
      <Button
        onClick={() => setShowVoiceCreate(true)}
        size="lg"
        className="fixed right-4 bottom-32 sm:bottom-24 md:bottom-8 z-30 h-14 w-14 rounded-full shadow-xl p-0"
        aria-label="New project"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Voice-first entry — the one canonical creation flow */}
      <VoiceFirstCreateModal
        open={showVoiceCreate}
        onOpenChange={setShowVoiceCreate}
        onCreated={fetchProjects}
        onExpand={() => { setShowVoiceCreate(false); navigate("/desk/new-room"); }}
      />
    </div>
  );
};

export default ProjectsList;
