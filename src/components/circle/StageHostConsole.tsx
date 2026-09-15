import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Clock, Users, Award, ShieldCheck, BookmarkPlus, CalendarClock, Hand } from "lucide-react";

type Outcome = "co_sign" | "credit" | "rolodex" | "followup";

interface Stage {
  id: string;
  type: "scout" | "showcase";
  status: string;
  turn_seconds: number;
}

interface Application {
  id: string;
  user_id: string;
  pitch: string | null;
  voice_url: string | null;
  status: string;
  match_score: number | null;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null; primary_role: string | null } | null;
}

interface RaisedHand {
  id: string;
  user_id: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

/**
 * Host-only console under the stage page. Shows pending + accepted applicants,
 * lets host review (accept/decline), and start/end turns when live.
 *
 * Also surfaces curated_stage_raised_hands -- the audience's own "ask to
 * speak" queue (raise-hand-stage / promote-raised-hand edge functions),
 * which is a *separate* persisted mechanism from the applications/turns flow
 * above (an audience member can ask to come up without ever having applied).
 * Before this, nothing in the client ever read curated_stage_raised_hands or
 * called promote-raised-hand, so a raised hand here was invisible to the
 * host and could never be acted on -- see src/lib/stageParticipants.ts for
 * the full picture of this app's three previously-uncoordinated
 * waiting/speaking mechanisms. Promoting a raised hand already creates a
 * curated_stage_turns row server-side (promote-raised-hand/index.ts), so
 * wiring this section in makes that mechanism consistent with the
 * applications-driven "Pull up" flow instead of sitting dead.
 */
export function StageHostConsole({ stage }: { stage: Stage }) {
  const { toast } = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const [handActionId, setHandActionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("curated_stage_applications")
        .select("id,user_id,pitch,voice_url,status,match_score,created_at")
        .eq("stage_id", stage.id)
        .order("match_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (!data || !mounted) { setLoading(false); return; }

      // Hydrate profiles
      const ids = Array.from(new Set(data.map((d: any) => d.user_id)));
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, full_name, avatar_url, primary_role")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const enriched = data.map((a: any) => ({ ...a, profile: profMap.get(a.user_id) || null }));
      if (mounted) { setApps(enriched as any); setLoading(false); }
    };
    load();

    const channel = supabase.channel(`stage_apps_${stage.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stage_applications", filter: `stage_id=eq.${stage.id}` },
        () => load().catch(() => {}))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [stage.id]);

  // Only live while the stage is actually live -- mirrors raise-hand-stage's
  // own "Stage not live" guard, and there's nothing for a host to promote
  // into before the room exists.
  useEffect(() => {
    if (stage.status !== "live") { setRaisedHands([]); return; }
    let mounted = true;
    const loadHands = async () => {
      const { data } = await supabase
        .from("curated_stage_raised_hands")
        .select("id,user_id,created_at")
        .eq("stage_id", stage.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (!data || !mounted) return;

      const ids = Array.from(new Set(data.map((d: any) => d.user_id)));
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const enriched = data.map((h: any) => ({ ...h, profile: profMap.get(h.user_id) || null }));
      if (mounted) setRaisedHands(enriched as any);
    };
    loadHands();

    const channel = supabase.channel(`stage_hands_${stage.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "curated_stage_raised_hands", filter: `stage_id=eq.${stage.id}` },
        () => loadHands().catch(() => {}))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [stage.id, stage.status]);

  const actOnHand = async (handId: string, dismiss: boolean) => {
    setHandActionId(handId);
    try {
      const { error } = await supabase.functions.invoke("promote-raised-hand", {
        body: dismiss ? { hand_id: handId, dismiss: true } : { hand_id: handId },
      });
      if (error) throw error;
      toast({ title: dismiss ? "Hand dismissed" : "Brought up to speak" });
      // Optimistic remove -- the postgres_changes subscription above will
      // also re-sync shortly, this just avoids a visible flash of a
      // now-stale "pending" row.
      setRaisedHands((prev) => prev.filter((h) => h.id !== handId));
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e?.message, variant: "destructive" });
    } finally {
      setHandActionId(null);
    }
  };

  const review = async (appId: string, decision: "accepted" | "declined" | "waitlist") => {
    setReviewing(appId);
    try {
      const { error } = await supabase.functions.invoke("review-stage-application", {
        body: { application_id: appId, decision },
      });
      if (error) throw error;
      toast({ title: decision === "accepted" ? "Accepted" : decision === "declined" ? "Declined" : "Waitlisted" });
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e?.message, variant: "destructive" });
    } finally { setReviewing(null); }
  };

  if (loading) return null;

  const pending = apps.filter((a) => a.status === "pending");
  const accepted = apps.filter((a) => a.status === "accepted");

  return (
    <Card className="p-4 space-y-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Host console</p>
          <p className="text-sm font-bold mt-0.5">{apps.length} applications</p>
        </div>
        <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{accepted.length} confirmed</Badge>
      </div>

      {raisedHands.length > 0 && (
        <section className="space-y-2 rounded-lg border border-energy/40 bg-energy/5 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-energy flex items-center gap-1.5">
            <Hand className="h-3 w-3" /> Wants to speak · {raisedHands.length}
          </p>
          <div className="space-y-2">
            {raisedHands.map((h) => (
              <div key={h.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={h.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{(h.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <p className="flex-1 text-sm font-semibold truncate">{h.profile?.full_name ?? "Audience member"}</p>
                <Button size="sm" variant="ghost" disabled={handActionId === h.id}
                  onClick={() => actOnHand(h.id, true)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="lime" disabled={handActionId === h.id}
                  onClick={() => actOnHand(h.id, false)}>
                  <Clock className="h-3 w-3 mr-1" /> Bring up
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pending review</p>
          {pending.map((a) => (
            <ApplicantRow key={a.id} app={a} reviewing={reviewing === a.id}
              onAccept={() => review(a.id, "accepted")}
              onDecline={() => review(a.id, "declined")}
            />
          ))}
        </section>
      )}

      {accepted.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Confirmed lineup</p>
          {accepted.map((a) => (
            <ApplicantRow key={a.id} app={a} confirmed turnSeconds={stage.turn_seconds} live={stage.status === "live"} stageId={stage.id} />
          ))}
        </section>
      )}

      {apps.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No applications yet. Share the stage link to drive applicants.
        </p>
      )}
    </Card>
  );
}

function ApplicantRow({
  app, reviewing, onAccept, onDecline, confirmed, turnSeconds, live, stageId,
}: {
  app: Application;
  reviewing?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  confirmed?: boolean;
  turnSeconds?: number;
  live?: boolean;
  stageId?: string;
}) {
  const { toast } = useToast();
  const [turnLoading, setTurnLoading] = useState(false);

  const startTurn = async () => {
    if (!stageId) return;
    setTurnLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-stage-turn", {
        body: { stage_id: stageId, applicant_user_id: app.user_id },
      });
      if (error) throw error;
      toast({ title: `Turn started — ${turnSeconds ?? 120}s`, description: "Use the in-call controls to wrap." });
      // Auto-end after duration
      if (data?.turn?.id && turnSeconds) {
        setTimeout(() => {
          supabase.functions.invoke("end-stage-turn", {
            body: { turn_id: data.turn.id, outcome: "timeout" },
          }).catch(() => {});
        }, turnSeconds * 1000);
      }
    } catch (e: any) {
      toast({ title: "Couldn't start turn", description: e?.message, variant: "destructive" });
    } finally { setTurnLoading(false); }
  };

  const [outcomeLoading, setOutcomeLoading] = useState<Outcome | null>(null);
  const [recordedOutcome, setRecordedOutcome] = useState<Outcome | null>(null);

  const recordOutcome = async (outcome: Outcome) => {
    if (!stageId) return;
    setOutcomeLoading(outcome);
    try {
      const { error } = await supabase.functions.invoke("record-stage-outcome", {
        body: { stage_id: stageId, applicant_user_id: app.user_id, outcome },
      });
      if (error) throw error;
      setRecordedOutcome(outcome);
      const label: Record<Outcome, string> = {
        co_sign: "Co-sign sent",
        credit: "Stamp added",
        rolodex: "Saved to Rolodex",
        followup: "Follow-up scheduled",
      };
      toast({ title: label[outcome] });
    } catch (e: any) {
      toast({ title: "Couldn't record", description: e?.message, variant: "destructive" });
    } finally { setOutcomeLoading(null); }
  };

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-card border border-border">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={app.profile?.avatar_url ?? undefined} />
          <AvatarFallback>{(app.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-sm leading-tight">{app.profile?.full_name ?? "Applicant"}</p>
            {typeof app.match_score === "number" && app.match_score >= 0.6 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                {Math.round(app.match_score * 100)}% match
              </Badge>
            )}
          </div>
          {app.profile?.primary_role && <p className="text-[11px] text-muted-foreground">{app.profile.primary_role}</p>}
          {app.pitch && <p className="text-xs mt-1.5 line-clamp-3">{app.pitch}</p>}
          {app.voice_url && (
            <a href={app.voice_url} target="_blank" rel="noopener noreferrer"
              className="inline-block text-[11px] font-semibold text-primary hover:underline mt-1">
              Open sample link →
            </a>
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-1.5">
          {confirmed ? (
            live ? (
              <Button size="sm" variant="lime" onClick={startTurn} disabled={turnLoading}>
                <Clock className="h-3 w-3 mr-1" /> Pull up
              </Button>
            ) : (
              <Badge variant="outline" className="text-[10px]">Confirmed</Badge>
            )
          ) : (
            <>
              <Button size="sm" onClick={onAccept} disabled={reviewing}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={onDecline} disabled={reviewing}>
                <X className="h-3 w-3 mr-1" /> Pass
              </Button>
            </>
          )}
        </div>
      </div>

      {confirmed && stageId && (
        <div className="pt-2 border-t border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            One-tap outcome {recordedOutcome && <span className="text-[hsl(var(--energy))]">· last: {recordedOutcome.replace("_", "-")}</span>}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            <OutcomeBtn icon={ShieldCheck} label="Co-sign" active={recordedOutcome === "co_sign"} loading={outcomeLoading === "co_sign"} onClick={() => recordOutcome("co_sign")} />
            <OutcomeBtn icon={Award} label="Credit" active={recordedOutcome === "credit"} loading={outcomeLoading === "credit"} onClick={() => recordOutcome("credit")} />
            <OutcomeBtn icon={BookmarkPlus} label="Rolodex" active={recordedOutcome === "rolodex"} loading={outcomeLoading === "rolodex"} onClick={() => recordOutcome("rolodex")} />
            <OutcomeBtn icon={CalendarClock} label="Follow-up" active={recordedOutcome === "followup"} loading={outcomeLoading === "followup"} onClick={() => recordOutcome("followup")} />
          </div>
        </div>
      )}
    </div>
  );
}

function OutcomeBtn({
  icon: Icon, label, active, loading, onClick,
}: {
  icon: any; label: string; active?: boolean; loading?: boolean; onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "lime" : "outline"}
      onClick={onClick}
      disabled={loading}
      className="h-auto py-1.5 px-1 flex-col gap-0.5 text-[10px] font-bold"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}
