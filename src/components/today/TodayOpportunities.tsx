import { useState, type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bell, Calendar, Check, LayoutGrid, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TodaySectionShell } from "@/components/home/TodaySectionShell";
import { SurfaceProactiveCards } from "@/components/agent/SurfaceProactiveCards";
import { ApprovalsHub } from "@/components/agent/ApprovalsHub";
import { ScoutedGigsSection } from "@/components/opportunity/ScoutedGigsSection";
import { DailyBriefingCard } from "@/components/home/DailyBriefingCard";
import { KretoTip } from "@/components/agent/KretoTip";
import { MoneyBrief } from "@/components/thrivepay/MoneyBrief";
import { TrendingLane } from "@/components/discover/TrendingLane";
import { UpcomingSessionsCard } from "@/components/home/UpcomingSessionsCard";
import { SpeedTonightCard } from "@/components/home/SpeedTonightCard";
import { CuratedStagesRail } from "@/components/circle/CuratedStagesRail";
import { GetStartedChecklist } from "@/components/onboarding/GetStartedChecklist";
import { DuplicateAccountBanner } from "@/components/account/DuplicateAccountBanner";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { completeTask, snoozeTaskToTomorrow } from "./today.actions";
import type { OpportunityTab, TodaySignals } from "./today.types";

interface TodayOpportunitiesProps {
  signals: TodaySignals;
  onSignalsChanged: () => void;
  peopleForYou?: ReactNode;
  showOnboardingChecklist?: boolean;
}

/**
 * TodayOpportunities — "what happens next", as one unified stream behind a
 * compact segmented control (For you / Calls / People / Studio) instead of
 * four separate pages. "For you" is a real priority merge (time-sensitive
 * work > money > Studio > discovery), not just a re-list of everything;
 * the other three tabs are focused, single-purpose views onto the same
 * underlying data Momentum already fetched -- no new queries here beyond
 * the widgets that already owned their own data (ScoutedGigsSection,
 * MoneyBrief, etc.), which this component composes rather than
 * reimplements.
 */
export function TodayOpportunities({ signals, onSignalsChanged, peopleForYou, showOnboardingChecklist }: TodayOpportunitiesProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<OpportunityTab>("for-you");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { deadlines, approvalCount, unreadMessages } = signals;

  const tabs: Array<{ key: OpportunityTab; label: string; count?: number }> = [
    { key: "for-you", label: "For you" },
    { key: "calls", label: "Calls" },
    { key: "people", label: "People" },
    { key: "studio", label: "Studio", count: deadlines.length || undefined },
  ];

  const handleCompleteDeadline = async (id: string, title: string) => {
    setBusyId(id);
    try {
      await completeTask(id);
      toast({ title: "Marked complete", description: title });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't complete that task", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };
  const handleSnoozeDeadline = async (id: string) => {
    setBusyId(id);
    try {
      await snoozeTaskToTomorrow(id);
      toast({ title: "Snoozed to tomorrow" });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't snooze that task", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const deadlineRow = (d: TodaySignals["deadlines"][number]) => (
    <motion.div
      key={d.id}
      initial={reducedMotion ? false : { opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        d.overdue ? "border-destructive/30 bg-destructive/[0.03]" : "border-border bg-background/60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{d.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {d.projectTitle} · {d.overdue ? "Overdue" : new Date(d.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => handleCompleteDeadline(d.id, d.title)} aria-label={`Mark ${d.title} complete`} className="h-8 w-8 p-0">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => handleSnoozeDeadline(d.id)} aria-label={`Snooze ${d.title}`} className="h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate(`/desk/${d.projectId}`)} aria-label={`Open ${d.projectTitle}`} className="h-8 w-8 p-0">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );

  return (
    <TodaySectionShell icon={<LayoutGrid className="h-4 w-4" />} eyebrow="Next moves" title="What's next">
      <div role="tablist" aria-label="Filter next moves" className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1 opacity-80">{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === "for-you" && (
          <>
            <SurfaceProactiveCards surface="home" className="px-0" limit={3} />
            <ApprovalsHub limit={4} />
            {deadlines.filter((d) => d.overdue).length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Time-sensitive
                </p>
                {deadlines.filter((d) => d.overdue).slice(0, 3).map(deadlineRow)}
              </section>
            )}
            <MoneyBrief variant="compact" />
            {showOnboardingChecklist && <GetStartedChecklist />}
            <KretoTip surface="today" />
            <DailyBriefingCard />
          </>
        )}

        {tab === "calls" && (
          <section className="space-y-4">
            <ScoutedGigsSection limit={6} />
            <TrendingLane />
          </section>
        )}

        {tab === "people" && (
          <section className="space-y-4">
            {peopleForYou ?? <p className="text-sm text-muted-foreground px-1">No new recommendations yet — Match learns from your Passport as it grows.</p>}
          </section>
        )}

        {tab === "studio" && (
          <section className="space-y-4">
            {deadlines.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Upcoming deadlines
                </p>
                {deadlines.map(deadlineRow)}
              </div>
            )}
            <UpcomingSessionsCard />
            <CuratedStagesRail limit={6} hideWhenEmpty />
            <SpeedTonightCard />
          </section>
        )}

        {unreadMessages > 0 && (
          <button
            onClick={() => navigate("/messages")}
            className="w-full flex items-center gap-2.5 rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-left hover:border-primary/40 transition-colors"
          >
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium flex-1">
              {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        <DuplicateAccountBanner />
        <PushNotificationPrompt trigger="default" />
      </div>
    </TodaySectionShell>
  );
}

export default TodayOpportunities;
