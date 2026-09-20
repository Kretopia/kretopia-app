import { Sparkles, MessageCircle, ListChecks, ChevronDown, Check, AlarmClock, Clock, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import { CtaButton } from "@/components/ui/cta-button";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/hooks/use-toast";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import type { ProfileRow, TodaySignals } from "./today.types";
import { acceptProposal, completeTask, dismissProposal, fillKretoPrompt, openKretoChat, snoozeTaskToTomorrow } from "./today.actions";
import { TodayMiniPassport } from "./TodayMiniPassport";

const TODAY_TUTORIAL: TutorialStep[] = [
  { icon: Sparkles, title: "Tell Kreto what's next", body: "Type or speak what you're working on — Kreto routes it to a new workspace, a people search, a gig search, or a straight answer." },
  { icon: ListChecks, title: "Your command center", body: "Your Passport, active work and the one thing that matters most right now — based on your actual information." },
  { icon: ChevronDown, title: "Momentum and Next moves", body: "What's actually moving this week, and everything worth doing next, organized by what matters most." },
];

interface TodayCommandCenterProps {
  firstName?: string;
  profile?: ProfileRow | null;
  creditCount?: number;
  signals: TodaySignals;
  onSignalsChanged: () => void;
}

/**
 * TodayCommandCenter — greeting, Kreto's presence, Passport readiness, and
 * the single highest-priority action, all above the fold. This is the one
 * place a returning user should be able to look and know what to do next
 * without scrolling. Primary CTA adapts to today.selectors.ts's priority
 * table; at most two secondary quick actions (Draft outreach / Or just
 * chat) sit in the header, exactly as before.
 */
export function TodayCommandCenter({ firstName, profile, creditCount = 0, signals, onSignalsChanged }: TodayCommandCenterProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  const { priority, primaryCta, passport } = signals;

  const runPrimaryCta = () => {
    if ("href" in primaryCta) navigate(primaryCta.href);
    else if (primaryCta.event === "thrive-copilot:open") openKretoChat();
    else fillKretoPrompt(String(primaryCta.detail?.prompt ?? ""));
  };

  const handleComplete = async () => {
    if (priority.kind !== "task") return;
    try {
      await completeTask(priority.task.id);
      toast({ title: "Marked complete", description: priority.task.title });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't complete that task", variant: "destructive" });
    }
  };
  const handleSnooze = async () => {
    if (priority.kind !== "task") return;
    try {
      await snoozeTaskToTomorrow(priority.task.id);
      toast({ title: "Snoozed to tomorrow" });
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't snooze that task", variant: "destructive" });
    }
  };
  const handleAccept = async () => {
    if (priority.kind !== "approval") return;
    try {
      await acceptProposal(priority.approval.id);
      if (priority.approval.href) navigate(priority.approval.href);
      else onSignalsChanged();
    } catch {
      toast({ title: "Couldn't open that suggestion", variant: "destructive" });
    }
  };
  const handleDismiss = async () => {
    if (priority.kind !== "approval") return;
    try {
      await dismissProposal(priority.approval.id);
      onSignalsChanged();
    } catch {
      toast({ title: "Couldn't dismiss that", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <FeaturePageHeader
        eyebrow="Today"
        title={firstName ? `${firstName},` : "Today,"}
        accentTitle="here's what moves you forward today."
        subtitle={priorityLine(signals)}
        tutorial={{ featureKey: "today", label: "How Today works", steps: TODAY_TUTORIAL }}
        compact
        tabs={
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Button
              type="button"
              onClick={() => fillKretoPrompt("Draft outreach to a sponsor or brand", true)}
              variant="glass"
              className="gap-1.5 rounded-full"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Draft outreach
            </Button>
            <Button
              type="button"
              onClick={openKretoChat}
              variant="outline"
              className="gap-1.5 rounded-full"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Or just chat
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.35fr)] gap-3">
        {passport && profile ? <TodayMiniPassport profile={profile} creditCount={creditCount} completion={passport.percentage} /> : null}

        <div className="relative min-h-[210px] overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.03] p-4 sm:p-5 flex flex-col">
          <div className="absolute right-2 bottom-0 hidden sm:block opacity-90 pointer-events-none" aria-hidden>
            <KretoCharacter variant="main" size={138} floatAmplitude={3} floatDuration={8} />
          </div>
          <div className="relative z-[2] sm:pr-32">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Kreto · Creator intelligence</p>
            <p className="mt-1 text-xs text-muted-foreground">Based on your Passport, active work and current signals.</p>
          </div>
          <AnimatePresence mode="wait">
            {priority.kind === "task" ? (
              <motion.div key={priority.task.id} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="relative z-[2] flex-1 mt-4 sm:pr-32">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${priority.task.overdue ? "text-destructive" : "text-primary"}`}>
                  {priority.task.overdue ? <AlarmClock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {priority.task.overdue ? "Overdue" : "Due today"}
                </span>
                <p className="text-sm font-bold leading-snug text-foreground mt-1">{priority.task.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{priority.task.projectTitle}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button size="sm" onClick={handleComplete} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Complete</Button>
                  <Button size="sm" variant="outline" onClick={handleSnooze}>Snooze</Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/desk/${priority.task.projectId}`)} className="gap-1">
                    Open Project <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ) : priority.kind === "approval" ? (
              <motion.div key={priority.approval.id} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="relative z-[2] flex-1 mt-4 sm:pr-32">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Kreto suggests</p>
                <p className="text-sm font-bold leading-snug text-foreground mt-1">{priority.approval.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{priority.approval.body}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button size="sm" onClick={handleAccept} className="gap-1.5"><Check className="h-3.5 w-3.5" /> Review</Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss} className="gap-1.5"><X className="h-3.5 w-3.5" /> Not now</Button>
                </div>
              </motion.div>
            ) : priority.kind === "gig" ? (
              <motion.div key={priority.gig.id} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="relative z-[2] flex-1 mt-4 sm:pr-32">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Fresh Call</p>
                <p className="text-sm font-bold leading-snug text-foreground mt-1">{priority.gig.title}</p>
                {priority.gig.company && <p className="text-xs text-muted-foreground mt-0.5">{priority.gig.company}</p>}
                <Button size="sm" onClick={() => navigate("/scout")} className="gap-1.5 mt-3">View Call <ArrowRight className="h-3.5 w-3.5" /></Button>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="relative z-[2] flex-1 flex items-center gap-3 mt-4 sm:pr-32">
                <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">You're all caught up. A good moment to start something.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <CtaButton onClick={runPrimaryCta} className="relative z-[2] w-full sm:w-fit mt-3 gap-1.5">
            {primaryCta.label} <ArrowRight className="h-4 w-4" />
          </CtaButton>
        </div>
      </div>
    </div>
  );
}

function priorityLine(signals: TodaySignals): string {
  const { passport, stamps, priority } = signals;
  if (passport && !passport.isComplete && passport.percentage > 0 && passport.percentage < 80) {
    return `Your Passport is ${passport.percentage}% ready. Add your last campaign credit and I'll draft the co-sign request.`;
  }
  if (stamps && stamps.waitingForCoSign > 0) {
    return `${stamps.waitingForCoSign} credit${stamps.waitingForCoSign === 1 ? "" : "s"} just need a co-sign to become Passport Stamps.`;
  }
  if (priority.kind === "task" && priority.task.overdue) {
    return `"${priority.task.title}" is overdue on ${priority.task.projectTitle} — want it done or snoozed?`;
  }
  return "Your Creative Passport is doing the work — want me to draft an outreach DM?";
}

export default TodayCommandCenter;
