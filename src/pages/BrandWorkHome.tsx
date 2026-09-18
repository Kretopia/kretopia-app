import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { OPPORTUNITY_PUBLIC_COLUMNS } from "@/lib/opportunityColumns";
import { useAuth } from "@/hooks/useAuth";
import {
  Briefcase, DollarSign, ArrowRight, Plus,
  Clock, Building2, Users, UserSearch, Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useStudioGlobalModals } from "@/components/project/studio/useStudioGlobalModals";
import { TodayStrip } from "@/components/desk/TodayStrip";
import { PageTransition } from "@/components/PageTransition";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { STUDIO_BRAND_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { WorkHomeSkeleton } from "@/pages/WorkHomeSkeleton";

interface WidgetProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: { label: string; path: string };
  className?: string;
}

const Widget = ({ title, icon: Icon, children, action, className }: WidgetProps) => {
  const navigate = useNavigate();
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[hsl(var(--mode-accent))]" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {action && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => navigate(action.path)}>
            {action.label} <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
      <CardContent className="px-4 pb-4 pt-1">{children}</CardContent>
    </Card>
  );
};

/**
 * Brand/company Studio dashboard — hiring command center: post gigs,
 * review applicants, find talent, track hires. Split out of the former
 * monolithic WorkHome.tsx (which mixed this with the individual creator
 * dashboard and the account-type router in one 700-line file) so each
 * account-type variant is its own navigable, independently testable
 * file, per the Studio-home scalability pass.
 */
export const BrandWorkHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ posted: 0, active: 0, hired: 0, avgRating: 0 });
  const { modals, openVoiceCommand, openPalette, openWrapWeek } = useStudioGlobalModals();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // These 5 queries only ever depended on user.id -- none of them
      // depend on each other's *results* -- but were previously awaited
      // one after another, turning what should be ~2 round trips into 6+
      // sequential ones. Only `apps` (needs opps' ids) and the accepted-
      // applications count (needs userOpps' ids) genuinely depend on a
      // prior result, so those run as a second parallel batch below.
      const [oppsRes, totalPostedRes, activeCountRes, userOppsRes, reviewDataRes] = await Promise.all([
        supabase
          .from("opportunities")
          .select(OPPORTUNITY_PUBLIC_COLUMNS)
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("created_by", user.id),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("created_by", user.id).eq("status", "active"),
        supabase.from("opportunities").select("id").eq("created_by", user.id),
        supabase.from("company_reviews").select("rating").eq("company_id", user.id),
      ]);

      const opps = oppsRes.data;
      setOpportunities(opps || []);
      const userOpps = userOppsRes.data;

      const [appsRes, hiredCountRes] = await Promise.all([
        opps && opps.length > 0
          ? supabase.from("applications").select("opportunity_id").in("opportunity_id", opps.map(o => o.id))
          : Promise.resolve({ data: null as { opportunity_id: string }[] | null }),
        userOpps && userOpps.length > 0
          ? supabase.from("applications").select("*", { count: "exact", head: true }).in("opportunity_id", userOpps.map(o => o.id)).eq("status", "accepted")
          : Promise.resolve({ count: 0 }),
      ]);

      const counts: Record<string, number> = {};
      (appsRes.data || []).forEach(a => {
        counts[a.opportunity_id] = (counts[a.opportunity_id] || 0) + 1;
      });
      setApplicantCounts(counts);

      const reviewData = reviewDataRes.data;
      const avgRating = reviewData && reviewData.length > 0
        ? reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length
        : 0;

      setStats({
        posted: totalPostedRes.count || 0,
        active: activeCountRes.count || 0,
        hired: hiredCountRes.count || 0,
        avgRating,
      });

      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <WorkHomeSkeleton variant="hiring" />;
  }

  const activeOpps = opportunities.filter(o => o.status === "active" || o.status === "open");
  const closedOpps = opportunities.filter(o => o.status !== "active" && o.status !== "open");

  return (
    <PageTransition>
      <Helmet>
        <title>Studios | Kretopia</title>
        <meta name="description" content="Your hiring command center — post gigs, review applicants, and hire creators." />
      </Helmet>

      <FeaturePageHeader
        eyebrow="Hiring HQ"
        title="Studios."
        accentTitle="Your hiring command center."
        subtitle="Post, review applicants, find talent and track every hire — all in one room, same as a creator's Studio."
        tutorial={{ featureKey: "studio-brand", label: "How Studios works for Brands", steps: STUDIO_BRAND_TUTORIAL }}
      />

      {/* Wider on desktop, capped for readability — same treatment as the
          creator Studios dashboard, so a Brand's Desk genuinely spans the
          page as a real dashboard instead of a narrow single-column stack. */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-12 space-y-5">
        <TodayStrip
          onVoice={openVoiceCommand}
          onCommandPalette={openPalette}
          onWrapWeek={openWrapWeek}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <Card className="p-3 md:p-4 text-center cursor-pointer hover:border-energy/40 hover:bg-accent/30 transition-all" onClick={() => navigate("/manage-opportunities")}>
            <p className="text-xl md:text-2xl font-black tracking-tight">{stats.posted}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Posted</p>
          </Card>
          <Card className="p-3 md:p-4 text-center cursor-pointer hover:border-energy/40 hover:bg-accent/30 transition-all" onClick={() => navigate("/manage-opportunities")}>
            <p className="text-xl md:text-2xl font-black tracking-tight text-energy">{stats.active}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Active</p>
          </Card>
          <Card className="p-3 md:p-4 text-center cursor-pointer hover:border-energy/40 hover:bg-accent/30 transition-all">
            <p className="text-xl md:text-2xl font-black tracking-tight">{stats.hired}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Hired</p>
          </Card>
          <Card className="p-3 md:p-4 text-center cursor-pointer hover:border-energy/40 hover:bg-accent/30 transition-all">
            <p className="text-xl md:text-2xl font-black tracking-tight flex items-center justify-center gap-0.5">
              {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}
              {stats.avgRating > 0 && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Rating</p>
          </Card>
        </div>

        {/* Two-column dashboard body on desktop — listings get the wide
            column since they're the thing a Brand actually scans, Find
            Talent + quick actions sit in a persistent side rail instead of
            competing for the same vertical stack. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-5">
            <Widget title="Active Listings" icon={Briefcase} action={{ label: "Manage", path: "/manage-opportunities" }}>
              {activeOpps.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm font-medium mb-1">Post your first opportunity</p>
                  <p className="text-xs text-muted-foreground mb-3">Attract top creative talent by posting a gig or job listing.</p>
                  <Button size="sm" onClick={() => navigate("/post-opportunity")} className="gap-1">
                    <Plus className="h-3 w-3" /> Post a Gig
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeOpps.slice(0, 5).map((opp) => (
                    <div
                      key={opp.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/30 cursor-pointer transition-all"
                      onClick={() => navigate(`/opportunity/${opp.id}`)}
                    >
                      <Briefcase className="h-3.5 w-3.5 text-[hsl(var(--mode-accent))] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium truncate block">{opp.title}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(opp.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {applicantCounts[opp.id] > 0 && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <Users className="h-2.5 w-2.5" /> {applicantCounts[opp.id]}
                          </Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Widget>

            {closedOpps.length > 0 && (
              <Widget title="Past Listings" icon={Clock} action={{ label: "All", path: "/manage-opportunities" }}>
                <div className="space-y-2">
                  {closedOpps.slice(0, 3).map((opp) => (
                    <div
                      key={opp.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-all opacity-70"
                      onClick={() => navigate(`/opportunity/${opp.id}`)}
                    >
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{opp.title}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">{opp.status}</Badge>
                    </div>
                  ))}
                </div>
              </Widget>
            )}
          </div>

          <div className="space-y-5">
            <Card
              className="p-4 cursor-pointer hover:border-primary/30 transition-all bg-gradient-to-r from-primary/5 to-accent/5 border-primary/10"
              onClick={() => navigate("/talent-finder")}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <UserSearch className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Find Talent</p>
                  <p className="text-xs text-muted-foreground">Describe what you need — paid or barter — Smart Match finds them instantly</p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/post-opportunity")}>
                <Briefcase className="h-4 w-4" />
                <span className="text-xs">Post a Gig</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/talent-finder")}>
                <UserSearch className="h-4 w-4" />
                <span className="text-xs">Find Talent</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/thrivepay")}>
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Payments</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => navigate("/profile")}>
                <Building2 className="h-4 w-4" />
                <span className="text-xs">Company Page</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {modals}
    </PageTransition>
  );
};

export default BrandWorkHome;
