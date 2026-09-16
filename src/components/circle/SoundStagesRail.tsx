import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Video, Loader2, Users } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { CarouselPositionDots } from "@/components/ui/glass/CarouselPositionDots";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type SoundStage = {
  id: string;
  host_user_id: string;
  title: string;
  vibe_tag: string | null;
  mode: "video" | "audio";
  format: "open_1to1" | "open_group" | "audience";
  participant_count: number;
  started_at: string;
};

interface Props {
  onJoin: (stage: SoundStage) => void;
  /** Reports the live-stage count once known -- mirrors CuratedStagesRail's
   *  own onLoad, for callers that need to know whether this rail has
   *  anything to show without duplicating its fetch. Optional, additive:
   *  no existing caller passes it, behavior is unchanged for them. */
  onLoad?: (count: number) => void;
}

type HostProfile = { full_name: string | null; avatar_url: string | null; username: string | null };

/**
 * Electric signature rail of live Open Stages ("On Air now").
 * First card pops as the Headliner (magenta border + pulse halo).
 */
export function SoundStagesRail({ onJoin, onLoad }: Props) {
  const [stages, setStages] = useState<SoundStage[]>([]);
  const [hosts, setHosts] = useState<Record<string, HostProfile>>({});
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const reducedMotion = useReducedMotion();

  const fetchStages = async () => {
    const { data } = await supabase
      .from("sound_stages")
      .select("id, host_user_id, title, vibe_tag, mode, format, participant_count, started_at")
      .eq("is_live", true)
      .order("started_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as SoundStage[];
    setStages(rows);
    setLoading(false);
    onLoad?.(rows.length);

    const ids = Array.from(new Set(rows.map((r) => r.host_user_id))).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, username")
        .in("user_id", ids);
      const map: Record<string, HostProfile> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url, username: p.username };
      });
      setHosts(map);
    }
  };

  useEffect(() => {
    fetchStages().catch(() => setLoading(false));
    const ch = supabase
      .channel("sound-stages-rail")
      .on("postgres_changes", { event: "*", schema: "public", table: "sound_stages" }, () => {
        fetchStages().catch(() => {});
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the lot…
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-5 text-center space-y-1">
        <p className="text-sm font-semibold">No stages on air yet</p>
        <p className="text-xs text-muted-foreground">
          Be first up — pop open a stage and let people walk on.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Carousel setApi={setApi} opts={{ align: "start", dragFree: true, duration: reducedMotion ? 0 : 20 }} className="w-full" aria-label="Live sound stages">
      <CarouselContent className="-ml-4">
        {stages.map((s, idx) => {
          const host = hosts[s.host_user_id];
          const hostHandle = host?.username ? `@${host.username}` : host?.full_name ?? "Host";
          const ModeIcon = s.mode === "audio" ? Mic : Video;
          const isHeadliner = idx === 0;
          const formatLabel =
            s.format === "open_1to1" ? "1:1 Walk-on" :
            s.format === "audience" ? "Audience" : "Open Jam";

          return (
            <CarouselItem key={s.id} className="pl-4 basis-auto">
            <div className="w-[280px]">
              <div className="relative group">
                {isHeadliner && (
                  <div
                    aria-hidden
                    className="absolute -inset-1 rounded-[32px] opacity-30 blur-xl group-hover:opacity-50 transition-opacity animate-pulse"
                    style={{ background: "hsl(var(--signal-pink))" }}
                  />
                )}
                <button
                  onClick={() => onJoin(s)}
                  className={`relative w-full text-left rounded-[28px] p-5 space-y-5 overflow-hidden transition-colors bg-[hsl(var(--card))] ${
                    isHeadliner
                      ? "border-2 border-[hsl(var(--signal-pink))]"
                      : "border border-[hsl(var(--border))]"
                  }`}
                >
                  {/* Top row: host avatar + format/listener pills */}
                  <div className="flex justify-between items-start">
                    <div className="relative">
                      <div
                        className="w-14 h-14 rounded-2xl p-[2px] shadow-lg"
                        style={{
                          background: isHeadliner
                            ? "hsl(var(--signal-pink))"
                            : "hsl(var(--muted))",
                          boxShadow: isHeadliner
                            ? "0 8px 24px -8px hsl(var(--signal-pink) / 0.4)"
                            : undefined,
                        }}
                      >
                        <div className="w-full h-full rounded-[14px] overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center">
                          {host?.avatar_url ? (
                            <img src={host.avatar_url} alt={hostHandle} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base font-black text-foreground/60">
                              {(host?.full_name ?? "H").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="absolute -bottom-1 -right-1 border-2 rounded-full p-1.5"
                        style={{
                          background: isHeadliner ? "hsl(var(--signal-pink))" : "hsl(var(--muted))",
                          borderColor: "hsl(var(--card))",
                          color: isHeadliner ? "#fff" : "hsl(var(--foreground))",
                        }}
                      >
                        <ModeIcon className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"
                        style={
                          isHeadliner
                            ? { background: "hsl(var(--signal-pink))", color: "#fff" }
                            : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        {formatLabel}
                      </span>
                      <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full">
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ background: "hsl(var(--signal-teal))" }}
                        />
                        <span
                          className="text-xs font-bold font-mono tracking-tighter flex items-center gap-1"
                          style={{ color: "hsl(var(--signal-teal))" }}
                        >
                          <Users className="w-3 h-3" />
                          {s.participant_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Title + host */}
                  <div className="space-y-1">
                    <h3
                      className={`text-foreground font-extrabold text-xl tracking-tight leading-[1.15] line-clamp-2 transition-colors ${
                        isHeadliner ? "group-hover:text-[hsl(var(--signal-pink))]" : ""
                      }`}
                    >
                      {s.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Host:{" "}
                      <span
                        className="font-semibold"
                        style={isHeadliner ? { color: "hsl(var(--signal-teal))" } : undefined}
                      >
                        {hostHandle}
                      </span>
                    </p>
                  </div>

                  {/* CTA */}
                  <div
                    className="w-full py-3.5 text-center text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-[0.98]"
                    style={
                      isHeadliner
                        ? {
                            background: "hsl(var(--signal-pink))",
                            boxShadow: "0 10px 30px hsl(var(--signal-pink) / 0.4)",
                          }
                        : { background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }
                    }
                  >
                    Enter Stage
                  </div>
                </button>
              </div>
            </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious variant="glass" className="hidden sm:flex -left-3" aria-label="Previous — live sound stages" />
      <CarouselNext variant="glass" className="hidden sm:flex -right-3" aria-label="Next — live sound stages" />
      </Carousel>
      <CarouselPositionDots api={api} label="Live sound stages" className="mt-2" />
    </div>
  );
}
