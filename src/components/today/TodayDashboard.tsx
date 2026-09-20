import { lazy, Suspense, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BrandLoader } from "@/components/brand/BrandDots";
import { checkProfileCompletion } from "@/lib/profileCompletion";
import { cn } from "@/lib/utils";
import { TodayCommandCenter } from "./TodayCommandCenter";
import { TodayOpportunities } from "./TodayOpportunities";
import { useTodaySignals } from "./today.selectors";
import type { ProfileRow } from "./today.types";

// Lazy: recharts + half a dozen dialog components (Edit/QR/Share/EPK) add
// real weight, and this section is collapsed by default -- TodayDashboard
// itself is imported eagerly by UnifiedHome (every signed-in visitor's
// first paint), so bundling this into that same chunk would tax everyone
// to pay for a section most won't open on a given visit.
const TodayMetricsDashboard = lazy(() =>
  import("./TodayMetricsDashboard").then((m) => ({ default: m.TodayMetricsDashboard })),
);

interface TodayDashboardProps {
  firstName?: string;
  peopleForYou?: ReactNode;
  profile?: ProfileRow | null;
  profileFull?: ProfileRow | null;
  myCredits?: number;
}

/**
 * TodayDashboard — the single composed surface: greeting + Passport
 * readiness + priority action (TodayCommandCenter), what's actually
 * moving (TodayMomentum), then everything worth doing next
 * (TodayOpportunities). Replaces the previous three-component page
 * composition (TodayHeader / TodayDashboard / TodayWhatsNext in
 * src/components/home/) with one coherent dashboard and one shared data
 * layer -- see today.selectors.ts for why that collapses several
 * previously-duplicate `project_tasks` reads into one.
 */
export function TodayDashboard({ firstName, peopleForYou, profile, profileFull, myCredits = 0 }: TodayDashboardProps) {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion();
  const effectiveProfile = profileFull || profile || null;
  const signals = useTodaySignals(user?.id, effectiveProfile, myCredits);
  const refresh = signals.reload;
  // Collapsed by default -- progressive disclosure: Today's job is "what
  // should I do right now" (TodayCommandCenter/TodayOpportunities above);
  // the metrics dashboard is "how is my Passport doing", real but
  // secondary, so it doesn't compete with the priority action for the
  // first thing a visitor sees.
  const [showMetrics, setShowMetrics] = useState(false);

  if (!user) return null;

  const showOnboardingChecklist =
    !!effectiveProfile && checkProfileCompletion(effectiveProfile, myCredits).percentage < 50;

  return (
    // pb-28 matches UnifiedHome.tsx's own footer-wrapper convention for
    // the fixed bottom chrome (composer bar + bottom nav) -- without it,
    // whichever card happens to land at the viewport's natural bottom edge
    // on first load (often the priority action's Complete/Snooze row) is
    // partially covered until the user scrolls. Verified visually at
    // 375px width: Complete/Snooze fully clear the composer bar with this.
    <div className="space-y-4 pb-28">
      {signals.loading ? (
        <div className="flex items-center justify-center py-16" aria-busy="true">
          <BrandLoader />
        </div>
      ) : signals.error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.03] px-4 py-4 text-sm text-muted-foreground">
          Couldn't load today's dashboard. <button onClick={refresh} className="font-semibold text-primary underline underline-offset-2">Try again</button>
        </div>
      ) : (
        <>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: [0.2, 0.65, 0.3, 0.95] }}
          >
            <TodayCommandCenter firstName={firstName} profile={effectiveProfile} creditCount={myCredits} signals={signals} onSignalsChanged={refresh} />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.06, ease: [0.2, 0.65, 0.3, 0.95] }}
          >
            <TodayOpportunities
              signals={signals}
              onSignalsChanged={refresh}
              peopleForYou={peopleForYou}
              showOnboardingChecklist={showOnboardingChecklist}
            />
          </motion.div>

          {/* Passport dashboard -- replaces the old separate "Preview
              public Passport" / "Private dashboard" exits from Passport
              itself (Profile.tsx) with one unified surface here instead. */}
          {effectiveProfile && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.12, ease: [0.2, 0.65, 0.3, 0.95] }}
            >
              <button
                type="button"
                onClick={() => setShowMetrics((v) => !v)}
                aria-expanded={showMetrics}
                className="w-full flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">Your Passport dashboard</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Views, verification, standing and audience</p>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showMetrics && "rotate-180")} />
              </button>
              {showMetrics && (
                <div className="mt-3">
                  <Suspense fallback={<div className="flex items-center justify-center py-10" aria-busy="true"><BrandLoader /></div>}>
                    <TodayMetricsDashboard profile={effectiveProfile} onProfileUpdate={refresh} />
                  </Suspense>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

export default TodayDashboard;
