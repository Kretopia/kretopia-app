import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { BrandLoader } from "@/components/brand/BrandDots";
import { checkProfileCompletion } from "@/lib/profileCompletion";
import { TodayCommandCenter } from "./TodayCommandCenter";
import { TodayMomentum } from "./TodayMomentum";
import { TodayOpportunities } from "./TodayOpportunities";
import { useTodaySignals } from "./today.selectors";
import type { ProfileRow } from "./today.types";

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

  if (!user) return null;

  const showOnboardingChecklist =
    !!effectiveProfile && checkProfileCompletion(effectiveProfile, myCredits).percentage < 50;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 px-0.5">
        <Radio className="h-3 w-3 animate-pulse" style={{ color: "hsl(var(--energy))" }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live</span>
      </div>

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
            <TodayCommandCenter firstName={firstName} signals={signals} onSignalsChanged={refresh} />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.06, ease: [0.2, 0.65, 0.3, 0.95] }}
          >
            <TodayMomentum signals={signals} />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.12, ease: [0.2, 0.65, 0.3, 0.95] }}
          >
            <TodayOpportunities
              signals={signals}
              onSignalsChanged={refresh}
              peopleForYou={peopleForYou}
              showOnboardingChecklist={showOnboardingChecklist}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

export default TodayDashboard;
