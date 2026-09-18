import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { WorkHomeSkeleton } from "@/pages/WorkHomeSkeleton";
import { BrandWorkHome } from "@/pages/BrandWorkHome";
import { CreatorWorkHome } from "@/pages/CreatorWorkHome";

/**
 * Studio home's single entry point (routed at /desk) -- the only job
 * left here is picking which account-type dashboard to render once we
 * know it. BrandWorkHome and CreatorWorkHome used to be defined in this
 * same file (700+ lines mixing two full dashboard implementations with
 * this router), each with its own copy-pasted wiring for the four global
 * overlays (voice-first create, command palette, voice command, Wrap My
 * Week) -- now shared via useStudioGlobalModals so those four evolve in
 * one place instead of two. Splitting the two dashboards into their own
 * files makes each independently navigable and testable without
 * changing what either one renders.
 */
const WorkHome = () => {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setAccountType(data?.account_type || "individual");
        setChecking(false);
      });
  }, [user]);

  if (checking) {
    return <WorkHomeSkeleton variant="shell" />;
  }

  if (accountType === "company") return <BrandWorkHome />;
  return <CreatorWorkHome />;
};

export default WorkHome;
