import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  LayoutGrid,
  Inbox,
  MoreHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SuggestFoldersDialog } from "./SuggestFoldersDialog";
import { StudioOverflowToggle } from "./StudioOverflowToggle";
import type { StudioFolder } from "./studioHome.types";

export type { StudioFolder };

interface StudioFoldersBarProps {
  userId: string;
  folders: StudioFolder[];
  counts: Record<string, number>; // folder_id or "unfiled" -> count
  selected: string; // "all" | "unfiled" | folder id
  onSelect: (id: string) => void;
  onChanged: () => void;
  onDropProject?: (projectId: string, folderId: string | null) => void | Promise<void>;
}

// Map color name → tint. Kept as six distinct keys (folders already
// saved with these names in the DB must keep resolving), but every tint
// is now a shade of the brand pink or a neutral gray -- no rainbow.
const COLOR_TINT: Record<string, { bg: string; ring: string; ink: string }> = {
  teal: { bg: "bg-[hsl(327_100%_59%)]/10", ring: "ring-[hsl(327_100%_59%)]/40", ink: "text-[hsl(327_100%_59%)]" },
  magenta: { bg: "bg-[hsl(327_85%_50%)]/10", ring: "ring-[hsl(327_85%_50%)]/40", ink: "text-[hsl(327_85%_50%)]" },
  yellow: { bg: "bg-[hsl(240_8%_60%)]/10", ring: "ring-[hsl(240_8%_60%)]/40", ink: "text-[hsl(240_8%_60%)]" },
  green: { bg: "bg-[hsl(327_60%_68%)]/10", ring: "ring-[hsl(327_60%_68%)]/40", ink: "text-[hsl(327_60%_68%)]" },
  blue: { bg: "bg-[hsl(240_6%_40%)]/10", ring: "ring-[hsl(240_6%_40%)]/40", ink: "text-[hsl(240_6%_40%)]" },
  purple: { bg: "bg-[hsl(327_45%_75%)]/10", ring: "ring-[hsl(327_45%_75%)]/40", ink: "text-[hsl(327_45%_75%)]" },
};

const tintFor = (color: string | null | undefined) =>
  COLOR_TINT[(color || "teal").toLowerCase()] || COLOR_TINT.teal;

const COLOR_SWATCHES = ["teal", "magenta", "yellow", "green", "blue", "purple"];

const HINT_KEY = "studio-folders-hint-dismissed";

export const StudioFoldersBar = ({
  userId,
  folders,
  counts,
  selected,
  onSelect,
  onChanged,
  onDropProject,
}: StudioFoldersBarProps) => {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("teal");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Collapsed by default; once the user expands, stays expanded for the
  // rest of the session (matches the brief's "remember expanded/collapsed
  // state during the session" -- not persisted to the backend, no product
  // reason to).
  const [expanded, setExpanded] = useState(false);

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (!onDropProject) return;
    if (e.dataTransfer.types.includes("application/x-thrive-project")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== key) setDropTarget(key);
    }
  };
  const handleDragLeave = (key: string) => {
    if (dropTarget === key) setDropTarget(null);
  };
  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    if (!onDropProject) return;
    const projectId = e.dataTransfer.getData("application/x-thrive-project");
    setDropTarget(null);
    if (projectId) {
      e.preventDefault();
      onDropProject(projectId, folderId);
    }
  };

  const totalCount = (counts["unfiled"] ?? 0) + folders.reduce((sum, f) => sum + (counts[f.id] ?? 0), 0);
  const showSuggest = totalCount >= 3;

  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    if (folders.length === 0 && totalCount >= 2) {
      setShowHint(localStorage.getItem(HINT_KEY) !== "1");
    } else {
      setShowHint(false);
    }
  }, [folders.length, totalCount]);

  const createFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("studio_folders").insert({
      user_id: userId,
      name,
      color: newColor,
      sort_order: folders.length,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't create folder", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    setNewColor("teal");
    setCreateOpen(false);
    onChanged();
  };

  const renameFolder = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("studio_folders").update({ name }).eq("id", id);
    setBusy(false);
    if (error) {
      toast({ title: "Rename failed", description: error.message, variant: "destructive" });
      return;
    }
    setRenamingId(null);
    onChanged();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Delete this folder? Projects inside will move back to Unfiled.")) return;
    setBusy(true);
    const { error } = await supabase.from("studio_folders").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    if (selected === id) onSelect("all");
    onChanged();
  };

  // ── Width-aware one-line fit ────────────────────────────────────────
  // `stripRef` sits on the real visible strip -- a block-level element
  // whose width reflects the actual on-page available width regardless of
  // its own content, so measuring it (not the hidden row) is what makes
  // this respond to the real viewport. `measureRowRef`/`chipRefs` render
  // every folder chip once, off-flow, purely to read each chip's own
  // natural (content-driven) width. `allChipRef`/`unfiledRef`/
  // `newFolderRef` measure the three pinned controls that always share
  // the line, so they're subtracted from the available width instead of
  // guessed. `toggleMeasureRef` measures a hidden copy of the toggle at
  // its widest possible label for this folder set ("See {all of them}
  // more folders") -- an exact upper bound, not a guess, since the real
  // toggle only mounts once hiddenCount is already known and can't be
  // measured ahead of that without a flicker. The selected folder, if
  // any, is always force-included in the visible set even if measurement
  // would otherwise cut it off -- never hide the active folder behind
  // "See more" takes priority over keeping the toggle itself unclipped
  // in that one edge case.
  const stripRef = useRef<HTMLDivElement>(null);
  const measureRowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const allChipRef = useRef<HTMLDivElement>(null);
  const unfiledRef = useRef<HTMLDivElement>(null);
  const newFolderRef = useRef<HTMLButtonElement>(null);
  const toggleMeasureRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState<number>(folders.length);

  // Selected-first ordering so the active folder is the most likely to
  // land inside the naturally-measured fit count.
  const orderedFolders = (() => {
    if (selected === "all" || selected === "unfiled") return folders;
    const idx = folders.findIndex((f) => f.id === selected);
    if (idx <= 0) return folders;
    const copy = folders.slice();
    const [sel] = copy.splice(idx, 1);
    copy.unshift(sel);
    return copy;
  })();

  useLayoutEffect(() => {
    if (expanded) return; // no measurement needed once fully expanded
    const strip = stripRef.current;
    if (!strip) return;

    const recompute = () => {
      const stripWidth = strip.getBoundingClientRect().width;
      if (stripWidth === 0) return;
      const pinnedWidth = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().width + 8 : 0);
      const toggleReserved = orderedFolders.length > 0 ? pinnedWidth(toggleMeasureRef.current) : 0;
      const available =
        stripWidth - pinnedWidth(allChipRef.current) - pinnedWidth(unfiledRef.current) -
        pinnedWidth(newFolderRef.current) - toggleReserved;
      let used = 0;
      let count = 0;
      for (const f of orderedFolders) {
        const el = chipRefs.current.get(f.id);
        if (!el) break;
        const w = el.getBoundingClientRect().width + 8; // + gap
        // No "always show at least one" exception: on a narrow strip,
        // forcing in a chip that doesn't fit pushes the toggle itself
        // (already budgeted for in `available`) past the visible edge --
        // exactly the "unreachable See more" failure this measurement
        // exists to prevent. Zero visible folder chips + the toggle is a
        // valid, fully-reachable state; a chip that doesn't fit isn't.
        if (used + w > available) break;
        used += w;
        count += 1;
      }
      setFitCount(count);
    };

    recompute();
    const ro = new ResizeObserver(() => recompute());
    ro.observe(strip);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, orderedFolders.length, folders]);

  const selectedFolderId = selected !== "all" && selected !== "unfiled" ? selected : null;
  const visibleFolders = expanded
    ? orderedFolders
    : (() => {
        const base = orderedFolders.slice(0, fitCount);
        if (selectedFolderId && !base.some((f) => f.id === selectedFolderId)) {
          const sel = orderedFolders.find((f) => f.id === selectedFolderId);
          if (sel) return [...base, sel];
        }
        return base;
      })();
  const hiddenCount = orderedFolders.length - visibleFolders.length;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold tracking-wide uppercase text-muted-foreground">Folders</h3>
          <span className="text-[11px] text-muted-foreground/70">· {folders.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {showSuggest && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSuggestOpen(true)}
              className="h-8 px-2.5 rounded-full text-[12px] font-semibold text-[hsl(var(--signal-teal))] hover:bg-[hsl(var(--signal-teal))]/10 gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Suggest</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreateOpen(true)}
            className="h-8 px-2.5 rounded-full text-[12px] font-semibold text-muted-foreground hover:text-foreground gap-1"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">New</span>
          </Button>
        </div>
      </div>

      {showHint && (
        <div className="flex items-start gap-2 rounded-xl border border-[hsl(var(--signal-teal))]/30 bg-[hsl(var(--signal-teal))]/5 px-3 py-2 text-[12px]">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--signal-teal))]" />
          <div className="flex-1">
            <p className="font-semibold leading-tight">Tap a folder to open it</p>
            <p className="text-muted-foreground leading-snug mt-0.5">
              On a project card, tap <span className="font-semibold text-foreground">⋯</span> (or long-press) to move it. On desktop, drag a card onto any folder.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem(HINT_KEY, "1");
              setShowHint(false);
            }}
            className="shrink-0 h-5 w-5 grid place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Hidden measuring row: every user-folder chip rendered once,
          off-flow (absolute + invisible), purely so refs can report real
          rendered widths for the fit calculation above. Not reachable by
          keyboard or screen readers (aria-hidden + inert-equivalent). */}
      <div
        ref={measureRowRef}
        aria-hidden
        className="pointer-events-none absolute -z-10 flex gap-2 opacity-0"
        style={{ visibility: "hidden" }}
      >
        {orderedFolders.map((f) => (
          <div key={f.id} ref={(el) => { if (el) chipRefs.current.set(f.id, el); else chipRefs.current.delete(f.id); }}>
            <FolderChip tint={tintFor(f.color)} icon={<Folder className="h-3.5 w-3.5" />} label={f.name} count={counts[f.id] ?? 0} active={false} onClick={() => {}} />
          </div>
        ))}
        {orderedFolders.length > 0 && (
          <div ref={toggleMeasureRef}>
            <StudioOverflowToggle
              expanded={false}
              onToggle={() => {}}
              hiddenCount={orderedFolders.length}
              itemLabel="folder"
              controlsId="studio-folders-strip"
            />
          </div>
        )}
      </div>

      {/* Visible strip: one line by default, wraps when expanded. Ref'd
          for its own real width -- see the fit-measurement effect above. */}
      <div
        id="studio-folders-strip"
        ref={stripRef}
        className={cn("flex items-center gap-2", expanded ? "flex-wrap" : "flex-nowrap overflow-hidden")}
      >
        <div ref={allChipRef} className="shrink-0">
          <FolderChip
            active={selected === "all"}
            onClick={() => onSelect("all")}
            tint={{ bg: "bg-foreground/5", ring: "ring-foreground/30", ink: "text-foreground" }}
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label="All"
            count={totalCount}
          />
        </div>
        <div
          ref={unfiledRef}
          onDragOver={(e) => handleDragOver(e, "unfiled")}
          onDragLeave={() => handleDragLeave("unfiled")}
          onDrop={(e) => handleDrop(e, null)}
          className={cn(
            "rounded-full transition-all shrink-0",
            dropTarget === "unfiled" && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background",
          )}
        >
          <FolderChip
            active={selected === "unfiled"}
            onClick={() => onSelect("unfiled")}
            tint={{ bg: "bg-muted", ring: "ring-foreground/20", ink: "text-muted-foreground" }}
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Unfiled"
            count={counts["unfiled"] ?? 0}
          />
        </div>

        {visibleFolders.map((f) => {
          const tint = tintFor(f.color);
          const active = selected === f.id;
          const isRenaming = renamingId === f.id;
          const isOver = dropTarget === f.id;
          return (
            <div
              key={f.id}
              className={cn("relative group shrink-0 rounded-full transition-all", isOver && cn("ring-2 ring-offset-2 ring-offset-background", tint.ring))}
              onDragOver={(e) => handleDragOver(e, f.id)}
              onDragLeave={() => handleDragLeave(f.id)}
              onDrop={(e) => handleDrop(e, f.id)}
            >
              {isRenaming ? (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 py-1">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameFolder(f.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => renameFolder(f.id)}
                    className="h-6 w-28 text-[12px] px-1.5 border-0 bg-transparent focus-visible:ring-1"
                  />
                </div>
              ) : (
                <>
                  <FolderChip tint={tint} icon={<Folder className="h-3.5 w-3.5" />} label={f.name} count={counts[f.id] ?? 0} active={active} onClick={() => onSelect(f.id)} className="pr-7" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute top-1/2 -translate-y-1/2 right-1.5 h-5 w-5 grid place-items-center rounded-full text-muted-foreground/70 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background/60 transition-opacity"
                        aria-label={`${f.name} folder options`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameValue(f.name);
                          setRenamingId(f.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFolder(f.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          );
        })}

        {orderedFolders.length > 0 && (hiddenCount > 0 || expanded) && (
          <StudioOverflowToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            hiddenCount={hiddenCount}
            itemLabel="folder"
            controlsId="studio-folders-strip"
          />
        )}

        <button
          ref={newFolderRef}
          onClick={() => setCreateOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/80 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/30 transition-colors"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          New folder
        </button>
      </div>

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-[hsl(var(--signal-teal))]" />
              New folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="e.g. Client Work, 2026 Campaigns"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
              }}
            />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Color</p>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((c) => {
                  const t = tintFor(c);
                  const on = newColor === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn("h-8 w-8 rounded-full grid place-items-center transition-all", t.bg, on ? cn("ring-2", t.ring) : "ring-1 ring-border")}
                      aria-label={c}
                    >
                      <Folder className={cn("h-4 w-4", t.ink)} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={createFolder} disabled={busy || !newName.trim()}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuggestFoldersDialog userId={userId} open={suggestOpen} onOpenChange={setSuggestOpen} onApplied={onChanged} />
    </section>
  );
};

interface ChipProps {
  active: boolean;
  onClick: () => void;
  tint: { bg: string; ring: string; ink: string };
  icon: React.ReactNode;
  label: string;
  count: number;
  className?: string;
}

/** Compact pill -- replaces the old aspect-[5/4] card tile. Icon, name,
 *  count, all on one line; the whole strip now reads as an adaptive shelf
 *  instead of a wall of cards. */
const FolderChip = ({ active, onClick, tint, icon, label, count, className }: ChipProps) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/60 pl-2.5 pr-3 py-1.5 text-left transition-all max-w-[180px]",
      tint.bg,
      active ? cn("ring-2", tint.ring, "border-transparent shadow-sm") : "hover:border-foreground/30 hover:shadow-sm",
      className,
    )}
  >
    <span className={tint.ink}>{icon}</span>
    <span className="truncate text-[12.5px] font-semibold">{label}</span>
    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{count}</span>
  </button>
);
