import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkProfileCompletion } from "@/lib/profileCompletion";
import { deriveEvidenceState } from "@/lib/creditEvidence";
import type {
  MomentumData,
  PassportReadiness,
  PrimaryCtaAction,
  PriorityAction,
  ProfileRow,
  StampsSignal,
  TodaySignals,
  TodayTask,
} from "./today.types";

interface RawTaskRow {
  id: string;
  title: string;
  due_date: string;
  project_id: string;
  projects: { title: string } | null;
}
interface RawApprovalRow {
  id: string;
  title: string;
  body: string;
  action_intent: { href?: string } | null;
}
interface RawCreditRow {
  verification_status: string | null;
  verification_url: string | null;
  endorsement_count: number | null;
  verified_by_name: string | null;
  verified_by_user_id: string | null;
}

/**
 * Single source of truth for every Today signal, queried once per mount
 * instead of the three separate, overlapping `project_tasks` reads that
 * TodayFocus/Momentum/MoreFromToday each used to run independently. Screen
 * components read from this hook's return value; none of them query
 * `project_tasks`, `credits`, or `agent_proposals` directly anymore.
 *
 * Priority order for the single highest-value action, matching the
 * product brief exactly: overdue/due-today task > pending Kreto proposal
 * > freshest Scout gig > none. Never fabricated -- every branch either
 * reflects a real row or falls through.
 */
export function useTodaySignals(
  userId: string | undefined,
  profile: ProfileRow | null | undefined,
  myCredits: number,
): TodaySignals & { reload: () => void } {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<PriorityAction>({ kind: "none" });
  const [passport, setPassport] = useState<PassportReadiness | null>(null);
  const [stamps, setStamps] = useState<StampsSignal | null>(null);
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [approvalCount, setApprovalCount] = useState(0);
  const [deadlines, setDeadlines] = useState<TodayTask[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekOut = new Date();
    weekOut.setDate(weekOut.getDate() + 7);

    try {
      const [
        upcomingTasksRes,
        completedThisWeekRes,
        activeProjectsRes,
        approvalsRes,
        topApprovalRes,
        topGigRes,
        unreadRes,
        creditsRes,
      ] = await Promise.all([
        // One read covers both "the single most urgent task" (first row,
        // due<=today) and "this week's deadline list" (all rows through
        // weekOut) -- previously two separate queries in two components.
        supabase
          .from("project_tasks")
          .select("id, title, due_date, project_id, projects(title)")
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
          .neq("status", "done")
          .not("due_date", "is", null)
          .lte("due_date", weekOut.toISOString().slice(0, 10))
          .order("due_date", { ascending: true })
          .limit(8)
          .then((r) => (r.data as unknown as RawTaskRow[]) ?? [], () => [] as RawTaskRow[]),
        supabase
          .from("project_tasks")
          .select("id", { count: "exact", head: true })
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
          .eq("status", "done")
          .gte("updated_at", weekAgo.toISOString())
          .then((r) => r.count ?? 0, () => 0),
        supabase
          .from("projects")
          .select("id, title, status, mood, workspace_type")
          .neq("status", "completed")
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(3)
          .then((r) => r.data ?? [], () => []),
        supabase
          .from("agent_proposals")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", userId)
          .eq("status", "pending")
          .then((r) => r.count ?? 0, () => 0),
        supabase
          .from("agent_proposals")
          .select("id, title, body, action_intent")
          .eq("owner_user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .then((r) => (r.data?.[0] as unknown as RawApprovalRow) ?? null, () => null),
        supabase
          .from("scouted_gigs")
          .select("id, title, company")
          .eq("target_user_id", userId)
          .order("fit_score", { ascending: false })
          .limit(1)
          .then((r) => r.data?.[0] ?? null, () => null),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not in generated types yet, matches the existing call site this replaces
        supabase.rpc("get_unread_message_count" as any).then((r: { data: unknown }) => Number(r?.data) || 0, () => 0),
        supabase
          .from("credits")
          .select("verification_status, verification_url, endorsement_count, verified_by_name, verified_by_user_id")
          .eq("user_id", userId)
          .then((r) => (r.data as unknown as RawCreditRow[]) ?? [], () => [] as RawCreditRow[]),
      ]);

      const allDeadlines: TodayTask[] = upcomingTasksRes.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.project_id,
        projectTitle: t.projects?.title ?? "Untitled project",
        dueDate: t.due_date,
        overdue: t.due_date < today,
      }));
      setDeadlines(allDeadlines);
      setApprovalCount(approvalsRes);
      setUnreadMessages(unreadRes);

      // Priority action: first overdue/due-today task, else pending
      // proposal, else freshest gig, else none.
      const urgentTask = allDeadlines.find((d) => d.dueDate <= today);
      if (urgentTask) {
        setPriority({ kind: "task", task: urgentTask });
      } else if (topApprovalRes) {
        setPriority({
          kind: "approval",
          approval: {
            id: topApprovalRes.id,
            title: topApprovalRes.title,
            body: topApprovalRes.body,
            href: typeof topApprovalRes.action_intent?.href === "string" ? topApprovalRes.action_intent.href : null,
          },
        });
      } else if (topGigRes) {
        setPriority({ kind: "gig", gig: { id: topGigRes.id, title: topGigRes.title, company: topGigRes.company ?? null } });
      } else {
        setPriority({ kind: "none" });
      }

      if (profile) {
        const completion = checkProfileCompletion(profile, myCredits);
        setPassport({ percentage: completion.percentage, missingFields: completion.missingFields, isComplete: completion.isComplete });
      }

      const waitingForCoSign = creditsRes.filter((c) => {
        const state = deriveEvidenceState(c);
        return state === "claimed" || state === "evidence_backed" || state === "publicly_sourced";
      }).length;
      setStamps({ waitingForCoSign });

      const nextMilestone = allDeadlines.find((d) => d.dueDate > today) ?? null;
      const signals: MomentumData["signals"] = [];
      if (waitingForCoSign > 0) {
        signals.push({
          id: "stamps",
          icon: "stamp",
          text: `${waitingForCoSign} credit${waitingForCoSign === 1 ? "" : "s"} waiting for a co-sign`,
          ctaLabel: "Send co-sign requests",
          href: "/credits",
        });
      }
      const dueSoonProjects = new Map<string, { title: string; count: number }>();
      allDeadlines
        .filter((d) => d.dueDate <= weekOut.toISOString().slice(0, 10))
        .forEach((d) => {
          const cur = dueSoonProjects.get(d.projectId);
          dueSoonProjects.set(d.projectId, { title: d.projectTitle, count: (cur?.count ?? 0) + 1 });
        });
      dueSoonProjects.forEach((v, projectId) => {
        signals.push({
          id: `studio-${projectId}`,
          icon: "task",
          text: `${v.title} has ${v.count} task${v.count === 1 ? "" : "s"} due this week`,
          ctaLabel: "Open Studio",
          href: `/desk/${projectId}`,
        });
      });
      if (unreadRes > 0) {
        signals.push({
          id: "messages",
          icon: "message",
          text: `${unreadRes} unread message${unreadRes === 1 ? "" : "s"}`,
          ctaLabel: "Reply now",
          href: "/messages",
        });
      }

      setMomentum({
        completedThisWeek: completedThisWeekRes,
        activeProjects: (activeProjectsRes as Array<{ id: string; title: string; status: string | null; mood: string | null; workspace_type: string | null }>).map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          mood: p.mood,
          workspaceType: p.workspace_type,
        })),
        nextMilestone: nextMilestone
          ? { title: nextMilestone.title, projectTitle: nextMilestone.projectTitle, dueDate: nextMilestone.dueDate }
          : null,
        signals: signals.slice(0, 5),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load today's signals.");
    } finally {
      setLoading(false);
    }
  }, [userId, profile, myCredits]);

  useEffect(() => {
    load();
  }, [load]);

  const isNewUser = !!profile && (passport?.percentage ?? 0) === 0 && !momentum?.activeProjects.length;

  return {
    loading,
    error,
    isNewUser,
    priority,
    primaryCta: derivePrimaryCta({ priority, passport, stamps, momentum, approvalCount }),
    passport,
    stamps,
    momentum,
    approvalCount,
    deadlines,
    unreadMessages,
    reload: load,
  };
}

/**
 * Adaptive primary CTA -- exactly the priority table from the product
 * brief. Falls through to "Ask Kreto" (opens the existing copilot bus)
 * when nothing else applies, never a dead end.
 */
export function derivePrimaryCta(input: {
  priority: PriorityAction;
  passport: PassportReadiness | null;
  stamps: StampsSignal | null;
  momentum: MomentumData | null;
  approvalCount: number;
}): PrimaryCtaAction {
  const { priority, passport, stamps, momentum, approvalCount } = input;

  if (!passport) return { label: "Build my Passport", href: "/passport" };
  if (passport.percentage === 0) return { label: "Build my Passport", href: "/passport" };
  if (!passport.isComplete) return { label: "Complete my Passport", href: "/passport" };
  if (stamps && stamps.waitingForCoSign > 0) return { label: "Send co-sign requests", href: "/credits" };
  if (priority.kind === "approval") return { label: "Review Kreto's suggestion", href: priority.approval.href ?? "/desk" };
  if (approvalCount > 0) return { label: "Review pending approvals", href: "/desk" };
  if (momentum && momentum.activeProjects.length > 0 && momentum.signals.some((s) => s.icon === "task")) {
    const studioSignal = momentum.signals.find((s) => s.icon === "task");
    return { label: "Open Studio", href: studioSignal?.href ?? "/desk" };
  }
  if (priority.kind === "gig") return { label: "Review Calls", href: "/scout" };
  return { label: "Ask Kreto", event: "thrive-copilot:open" };
}
