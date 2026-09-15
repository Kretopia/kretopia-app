import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Flag, TrendingUp, Stamp, ListChecks, MessageSquare, Receipt, Calendar } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { moodGradient } from "@/components/project/studio/moodGradient";
import { TodaySectionShell } from "@/components/home/TodaySectionShell";
import type { MomentumSignal, TodaySignals } from "./today.types";

const ICONS: Record<MomentumSignal["icon"], typeof CheckCircle2> = {
  check: CheckCircle2,
  flag: Flag,
  stamp: Stamp,
  task: ListChecks,
  message: MessageSquare,
  invoice: Receipt,
  calendar: Calendar,
};

interface TodayMomentumProps {
  signals: TodaySignals;
}

/**
 * TodayMomentum — a compact, actionable control panel: what's actually
 * moving, each row with its own CTA. Not a decorative progress grid. Caps
 * at 5 live signals (today.selectors.ts already trims to that), so this
 * never grows into a second unbounded feed -- "All activity" lives in
 * TodayOpportunities' Studio tab for anything past the top 5.
 */
export function TodayMomentum({ signals }: TodayMomentumProps) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { momentum } = signals;

  if (!momentum) return null;
  if (momentum.completedThisWeek === 0 && momentum.activeProjects.length === 0 && momentum.signals.length === 0) return null;

  return (
    <TodaySectionShell icon={<TrendingUp className="h-4 w-4" />} eyebrow="Progress" title="Momentum" seeAllTo="/desk">
      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <div className="rounded-2xl border border-border bg-background/60 px-3.5 py-3">
          <p className="text-2xl font-black leading-none">{momentum.completedThisWeek}</p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> done this week
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 px-3.5 py-3">
          <p className="text-2xl font-black leading-none">{momentum.activeProjects.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Projects moving forward</p>
        </div>
      </div>

      {momentum.signals.length > 0 && (
        <div className="space-y-2 mb-3.5">
          {momentum.signals.map((signal) => {
            const Icon = ICONS[signal.icon];
            return (
              <motion.button
                key={signal.id}
                initial={reducedMotion ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate(signal.href)}
                className="w-full flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.03] px-3.5 py-2.5 text-left hover:border-primary/40 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">{signal.text}</span>
                <span className="text-[11px] font-semibold text-primary shrink-0 inline-flex items-center gap-0.5">
                  {signal.ctaLabel} <ArrowRight className="h-3 w-3" />
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {momentum.activeProjects.length > 0 && (
        <div className="flex sm:grid sm:grid-cols-3 gap-2.5 overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 scrollbar-hide snap-x snap-mandatory">
          {momentum.activeProjects.map((p) => {
            const grad = moodGradient ? moodGradient(p.mood || p.workspaceType || "general") : null;
            return (
              <motion.button
                key={p.id}
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/desk/${p.id}`)}
                className="group relative shrink-0 w-[200px] sm:w-auto snap-start rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all overflow-hidden text-left"
              >
                <div className="h-12 w-full" style={{ background: grad || "hsl(var(--color-accent) / 0.14)" }} />
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{p.status || "active"}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </TodaySectionShell>
  );
}

export default TodayMomentum;
