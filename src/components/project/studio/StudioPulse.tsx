import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Radio, UsersRound, ArrowRight } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { SoundStagesRail, type SoundStage } from "@/components/circle/SoundStagesRail";
import { SpeedTonightCard } from "@/components/home/SpeedTonightCard";
import { TodayStrip } from "@/components/desk/TodayStrip";
import { MyPendingInvitations } from "@/components/project/MyPendingInvitations";
import { CastingCallsRail } from "@/components/opportunity/CastingCallsRail";
import { RecentRecordingsRail } from "@/components/calls/RecentRecordingsRail";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Collaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

interface StudioPulseProps {
  recentCollaborators: Collaborator[];
  onVoice: () => void;
  onCommandPalette: () => void;
  onWrapWeek: () => void;
}

/**
 * StudioPulse — Session & Activity and Casting & Collaborators, merged
 * into the one "what's happening now / who's involved / what needs
 * attention" surface the product brief calls for, immediately below the
 * Studio header. Was two separately-stacked SectionCards; every real
 * sub-widget here is reused exactly as it already worked (own
 * data-fetching, own self-hiding-when-empty behavior) -- this component's
 * job is purely the shared container and visual hierarchy, not a
 * reimplementation of any of them.
 *
 * Internal sections, in priority order: primary live signal (Sound
 * Stages + tonight's Speed Session) -> crew pulse (recent collaborators +
 * open casting) -> recent activity (recordings, pending invites) ->
 * contextual quick actions (voice/command palette/wrap week). These are
 * internal subsections of one card, not repeated dashboard blocks.
 */
export function StudioPulse({ recentCollaborators, onVoice, onCommandPalette, onWrapWeek }: StudioPulseProps) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [collabApi, setCollabApi] = useState<CarouselApi>();
  const [liveSessionCount, setLiveSessionCount] = useState<number | null>(null);

  const hasCrew = recentCollaborators.length > 0;
  const sessionsKnown = liveSessionCount !== null;
  const hasLiveSession = (liveSessionCount ?? 0) > 0;

  return (
    <section aria-labelledby="studio-pulse-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-[hsl(var(--energy))]" aria-hidden />
        <h2 id="studio-pulse-title" className="text-[13px] font-semibold tracking-wide uppercase text-muted-foreground">
          Right now
        </h2>
      </div>

      {/* Primary live signal */}
      <div className="space-y-3">
        <SoundStagesRail onJoin={(stage: SoundStage) => navigate("/soundstages")} onLoad={setLiveSessionCount} />
        {sessionsKnown && !hasLiveSession && (
          <p className="text-xs text-muted-foreground">No live Sound Stage right now.</p>
        )}
        <SpeedTonightCard />
      </div>

      {/* Crew pulse */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <UsersRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Crew
          </h3>
        </div>

        {hasCrew ? (
          <div className="relative">
            <Carousel setApi={setCollabApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Recent collaborators">
              <CarouselContent className="-ml-3">
                {recentCollaborators.map((c) => (
                  <CarouselItem key={c.id} className="pl-3 basis-auto">
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${c.id}`)}
                      className="w-28 rounded-2xl border border-border bg-card p-3 text-center transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="h-14 w-14 mx-auto rounded-full overflow-hidden bg-muted mb-2">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {c.full_name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-semibold truncate">{c.full_name}</p>
                      {c.role && <p className="text-[10px] text-muted-foreground truncate">{c.role}</p>}
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3.5 py-3">
            <p className="text-sm text-muted-foreground">Build your crew for this Studio.</p>
            <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => navigate("/post-opportunity")}>
              Invite <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <CastingCallsRail />
      </div>

      {/* Recent activity */}
      <div className="space-y-3 border-t border-border pt-4">
        <RecentRecordingsRail />
        <MyPendingInvitations />
      </div>

      {/* Contextual action */}
      <div className="border-t border-border pt-4">
        <TodayStrip onVoice={onVoice} onCommandPalette={onCommandPalette} onWrapWeek={onWrapWeek} />
      </div>
    </section>
  );
}

export default StudioPulse;
