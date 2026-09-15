import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Shared shell + state primitives for the Credits dashboard.
 *
 * Typography note: nothing here declares a font-family. Every panel inherits
 * the single brand family from the global cascade — hierarchy is expressed
 * through size and weight only (H1 > H2 > H3 > body > metadata).
 */

const EASE = [0.2, 0.65, 0.3, 0.95] as const;

export function DashboardPanel({
  id,
  title,
  eyebrow,
  action,
  children,
  className,
  index = 0,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      // animate, not whileInView: these panels are tab content Radix
      // toggles via display:none <-> block, not real scroll-into-view.
      // whileInView's IntersectionObserver doesn't reliably re-fire when
      // a zero-size (display:none) element suddenly gets real dimensions
      // at its already-current scroll position -- confirmed live (opacity
      // stuck at 0, content fully present in the DOM/a11y tree but never
      // painted) on the Stamps tab specifically. animate responds to
      // React's own mount/prop lifecycle instead, which tab-switching
      // always goes through correctly.
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.45, ease: EASE, delay: reduced ? 0 : Math.min(index * 0.06, 0.24) }}
      className={cn(
        "group/panel relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors duration-300 hover:border-[hsl(var(--accent-passport))]/30 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, hsl(var(--accent-passport)/0.7), transparent)" }}
      />

      <header className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          )}
          <h2 id={id ? `${id}-heading` : undefined} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="relative">{children}</div>

    </motion.section>
  );
}

export function CreditsEmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function CreditsPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your credits…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/30" />
      ))}
    </div>
  );
}

export function CreditsErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center">
      <p className="text-sm font-medium text-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-glass btn-glass-outline mt-3 rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          Try again
        </button>
      )}
    </div>
  );
}
