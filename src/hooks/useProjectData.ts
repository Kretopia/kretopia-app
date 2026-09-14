import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasProAccess } from "@/lib/subscriptionConfig";
import { PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS } from "@/lib/projectColumns";

export interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
  collaborator_status?: string | null;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  user_id: string;
  message: string;
  created_at: string;
  reply_to?: string | null;
  is_pinned?: boolean;
  profiles?: { full_name: string; avatar_url: string | null } | null;
  [key: string]: any;
}

export function useProjectData(projectId: string | undefined) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, subscriptionInfo } = useAuth();
  const userId = user?.id;
  const isPro = hasProAccess(subscriptionInfo.tier as any);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<"creator" | "client">("creator");

  // Guards against cross-project flashes: switching from an already-loaded
  // Project to a different one used to leave the old Project's title/tasks/
  // files/messages on screen (no skeleton, nothing cleared) until the new
  // fetch resolved, and a slower in-flight fetch for a Project the user has
  // already navigated away from could still win the race and overwrite the
  // new Project's fresh data. Every fetch gets a generation id; only the
  // most recent one is allowed to apply its results.
  const requestIdRef = useRef(0);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, title, status, updated_at, deadline, workspace_type")
      .order("updated_at", { ascending: false });
    setProjects(data || []);
  }, []);

  const fetchCollaborators = useCallback(
    async (projectData: any) => {
      const { data: people, error } = await supabase.rpc("get_project_people" as any, {
        _project_id: projectData.id,
      });
      if (error) throw error;

      return ((people || []) as any[])
        .filter((p) => p.collaborator_status === "accepted")
        .map((p) => ({
          id: p.user_id,
          full_name: p.full_name || "Member",
          avatar_url: p.avatar_url,
          role: p.role,
          collaborator_status: p.collaborator_status,
        }));
    },
    []
  );

  const fetchMessages = useCallback(async () => {
    const { data: messagesData } = await supabase
      .from("project_messages")
      .select("*, reply_to, is_pinned")
      .eq("project_id", projectId!)
      .order("created_at", { ascending: true });

    if (!messagesData || messagesData.length === 0) return [];

    const userIds = [...new Set(messagesData.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    return messagesData.map((msg) => ({
      ...msg,
      profiles: profileMap.get(msg.user_id) || null,
    }));
  }, [projectId]);

  const fetchProjectData = useCallback(
    async (isInitial = false) => {
      if (!projectId || !userId) return;
      const requestId = ++requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      try {
        if (isInitial) {
          // A real Project switch (route param changed) — clear the previous
          // Project's state right away and show the skeleton, rather than
          // leaving stale content on screen until the new fetch resolves.
          // A same-Project refresh (isInitial=false, e.g. a realtime event)
          // never touches loading/clears state, so it stays flicker-free.
          setLoading(true);
          setProject(null);
          setCollaborators([]);
          setFiles([]);
          setMessages([]);
          setTasks([]);
          setMilestones([]);
        }

        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select(PROJECT_COLUMNS_EXCLUDING_LOCKED_FINANCIALS)
          .eq("id", projectId)
          .single();
        if (projectError) throw projectError;
        if (isStale()) return;

        await supabase
          .from("project_collaborators")
          .update({ status: "accepted" })
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .eq("status", "pending");

        const { data: hasAccess } = await supabase.rpc("user_has_project_access", {
          project_id_param: projectId,
          user_id_param: userId,
        });
        if (isStale()) return;
        if (!hasAccess) {
          toast({
            title: "Access denied",
            description: "You don't have access to this project",
            variant: "destructive",
          });
          navigate("/circle");
          return;
        }

        // client_price/creative_payout/margin_type/margin_value are no
        // longer selectable directly as of
        // 20260825100000_studio_role_based_money_rls.sql -- projectData
        // above never requests them (a missing column GRANT fails the
        // whole query, it doesn't silently drop the column the way an RLS
        // policy would, which is why the select above is an explicit list
        // rather than "*"). get_project_financials is owner-only (matches
        // useStudioRole.ts's documented canSeeMoney intent); merge it in
        // only when it succeeds, so a non-owner's projectData is left
        // without these fields rather than faking them as null/0.
        // Widened to `any` for this merge only: get_project_financials adds
        // back client_price/creative_payout/margin_type/margin_value, which
        // the select above deliberately omits from projectData's inferred
        // type (see comment above).
        let projectWithFinancials: any = projectData;
        try {
          const { data: financials } = await supabase.rpc("get_project_financials" as any, {
            _project_id: projectId,
          });
          const fin = financials as { success?: boolean; client_price?: number; creative_payout?: number; margin_type?: string; margin_value?: number } | null;
          if (fin?.success) {
            projectWithFinancials = {
              ...projectData,
              client_price: fin.client_price,
              creative_payout: fin.creative_payout,
              margin_type: fin.margin_type,
              margin_value: fin.margin_value,
            };
          }
        } catch (finErr) {
          console.error("get_project_financials failed", finErr);
        }
        if (isStale()) return;

        setProject(projectWithFinancials);
        setUserRole(projectData.created_by === userId ? "client" : "creator");

        const [collabs, msgs, filesRes, tasksRes, milestonesRes, milestoneFinancialsRes] = await Promise.all([
          fetchCollaborators(projectData),
          fetchMessages(),
          supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
          supabase.from("project_tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
          // amount/paid_to/paid_at/escrow_status/payment_intent_id are no
          // longer selectable directly as of
          // 20260825100000_studio_role_based_money_rls.sql -- select("*")
          // here now silently omits them for everyone. They're merged back
          // in below from get_project_milestone_financials, which is the
          // only remaining read path and enforces the same
          // owner/creative/collaborator-only rule (not client/guest) that
          // the Money section's own UI already tries to apply -- so a
          // client/guest collaborator now gets the real enforcement this
          // hook's data represents, not just a UI hint.
          supabase.from("milestones").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
          supabase.rpc("get_project_milestone_financials" as any, { _project_id: projectId }),
        ]);
        if (isStale()) return;

        const financialsByMilestoneId = new Map(
          ((milestoneFinancialsRes.data as any[]) || []).map((f) => [f.milestone_id, f])
        );
        const milestonesWithFinancials = (milestonesRes.data || []).map((m: any) => {
          const fin = financialsByMilestoneId.get(m.id);
          return fin
            ? {
                ...m,
                amount: fin.amount,
                paid_to: fin.paid_to,
                paid_at: fin.paid_at,
                escrow_status: fin.escrow_status,
                payment_intent_id: fin.payment_intent_id,
              }
            : m; // not authorized to see this milestone's money -- amount/paid_to/etc. stay absent, not faked as 0/null
        });

        setCollaborators(collabs);
        setMessages(msgs);
        setFiles(filesRes.data || []);
        setTasks(tasksRes.data || []);
        setMilestones(milestonesWithFinancials);
      } catch (error: any) {
        if (isStale()) return;
        console.error("Error fetching project data:", error);
        toast({ title: "Error loading project", description: error.message, variant: "destructive" });
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [projectId, userId, navigate, toast, fetchCollaborators, fetchMessages]
  );

  useEffect(() => {
    if (userId) fetchProjects();
  }, [userId, fetchProjects]);

  useEffect(() => {
    if (projectId && userId) {
      fetchProjectData(true);
      import("@/lib/analytics").then(({ analytics }) => {
        analytics.pageView("thrivedesk");
        analytics.featureUsed("thrivedesk_opened", { project_id: projectId });
      });
    }
  }, [projectId, userId, fetchProjectData]);

  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project:${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_files", filter: `project_id=eq.${projectId}` }, () => fetchProjectData())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` }, () => fetchProjectData())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks", filter: `project_id=eq.${projectId}` }, () => fetchProjectData())
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones", filter: `project_id=eq.${projectId}` }, () => fetchProjectData())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_collaborators", filter: `project_id=eq.${projectId}` }, () => fetchProjectData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchProjectData]);

  return {
    loading,
    project,
    collaborators,
    files,
    messages,
    tasks,
    milestones,
    projects,
    userRole,
    isPro,
    user,
    fetchProjectData,
    fetchProjects,
  };
}
