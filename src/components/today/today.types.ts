import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface TodayTask {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  dueDate: string;
  overdue: boolean;
}

export interface TodayApproval {
  id: string;
  title: string;
  body: string;
  href: string | null;
}

export interface TodayGig {
  id: string;
  title: string;
  company: string | null;
}

/** The single highest-priority thing to act on right now. Exactly one of
 *  these is ever populated -- see today.selectors.ts's priority order. */
export type PriorityAction =
  | { kind: "task"; task: TodayTask }
  | { kind: "approval"; approval: TodayApproval }
  | { kind: "gig"; gig: TodayGig }
  | { kind: "none" };

/** Adaptive primary CTA -- see the mission's own priority table. `href` is
 *  a route; `event` dispatches the existing thrive-prompt/copilot bus
 *  instead of navigating, for the two actions that open a composer in
 *  place rather than a new page. */
export type PrimaryCtaAction =
  | { label: string; href: string }
  | { label: string; event: "thrive-prompt:fill" | "thrive-copilot:open"; detail?: Record<string, unknown> };

export interface PassportReadiness {
  percentage: number;
  missingFields: string[];
  isComplete: boolean;
}

export interface StampsSignal {
  /** Credits the user owns that are evidence-backed or claimed but not yet
   *  co-signed/organization-confirmed -- i.e. genuinely actionable, not
   *  just "not maximally verified". */
  waitingForCoSign: number;
}

export interface MomentumSignal {
  id: string;
  icon: "check" | "flag" | "stamp" | "task" | "message" | "invoice" | "calendar";
  /** e.g. "2 credits are waiting for a co-sign" */
  text: string;
  ctaLabel: string;
  href: string;
}

export interface MomentumData {
  completedThisWeek: number;
  activeProjects: Array<{ id: string; title: string; status: string | null; mood?: string | null; workspaceType?: string | null }>;
  nextMilestone: { title: string; projectTitle: string; dueDate: string } | null;
  signals: MomentumSignal[];
}

export type OpportunityTab = "for-you" | "calls" | "people" | "studio";

export interface TodaySignals {
  loading: boolean;
  error: string | null;
  isNewUser: boolean;
  priority: PriorityAction;
  primaryCta: PrimaryCtaAction;
  passport: PassportReadiness | null;
  stamps: StampsSignal | null;
  momentum: MomentumData | null;
  approvalCount: number;
  deadlines: TodayTask[];
  unreadMessages: number;
}
