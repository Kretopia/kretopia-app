import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudioOverflowToggleProps {
  expanded: boolean;
  onToggle: () => void;
  /** Count of additional items hidden when collapsed -- omit the number
   *  in the label if this is 0/unknown (e.g. the folder strip only knows
   *  the fit count after measuring, so it renders "All folders" instead
   *  of a specific count when a precise number isn't available yet). */
  hiddenCount?: number;
  /** e.g. "folder" / "project" -- pluralized automatically. */
  itemLabel: string;
  /** Overrides the generated "See N more folders" label entirely, for
   *  callers with more specific copy (e.g. "See all 12 projects"). */
  expandLabel?: string;
  collapseLabel?: string;
  controlsId: string;
  className?: string;
}

/**
 * One shared "See more / Show less" control for both the folder strip and
 * the projects list, instead of two near-identical implementations. A
 * real <button> with aria-expanded + aria-controls, not a link or a div
 * -- reachable and operable by keyboard exactly like every other control
 * on this page.
 */
export function StudioOverflowToggle({
  expanded,
  onToggle,
  hiddenCount,
  itemLabel,
  expandLabel,
  collapseLabel = "Show less",
  controlsId,
  className,
}: StudioOverflowToggleProps) {
  const defaultExpandLabel =
    hiddenCount != null && hiddenCount > 0
      ? `See ${hiddenCount} more ${itemLabel}${hiddenCount === 1 ? "" : "s"}`
      : `All ${itemLabel}s`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      {expanded ? collapseLabel : expandLabel ?? defaultExpandLabel}
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
    </button>
  );
}
