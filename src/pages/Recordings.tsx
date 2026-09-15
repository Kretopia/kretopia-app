import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WatchReplayButton } from "@/components/calls/WatchReplayButton";
import { CallRecapSheet } from "@/components/calls/CallRecapSheet";
import { formatDistanceToNow } from "date-fns";
import { Video, Sparkles, Clock, ArrowLeft, FileVideo, RefreshCw } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { KretoTip } from "@/components/agent/KretoTip";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { StudioSectionTabs } from "@/components/studio-reference/StudioSectionTabs";

const RECORDINGS_TUTORIAL: TutorialStep[] = [
  { icon: Video, title: "Every call gets recorded", body: "Tap Record during any Kretopia call. The replay lands here about a minute after it ends." },
  { icon: Sparkles, title: "Kreto transcribes it for you", body: "Each recording is transcribed and summarized automatically — no manual note-taking." },
  { icon: FileVideo, title: "Pull the recap", body: "Open Recap on any call to get Kreto's extracted action items, not just a wall of transcript." },
];

type Row = {
  id: string;
  call_kind: string;
  status: "pending" | "transcribing" | "ready" | "failed";
  duration_seconds: number | null;
  created_at: string;
  recording_id: string | null;
  project_id: string | null;
  summary: string | null;
};

const fmtDur = (s: number | null) => {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const KIND_LABEL: Record<string, string> = {
  project: "Studio call",
  direct: "1:1 call",
  circle: "Circle call",
  meeting: "Meeting",
  event: "Event",
  sound_stage: "Sound Stage",
  speed_session: "Speed session",
  curated_stage: "Showcase",
};

export default function Recordings() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recapId, setRecapId] = useState<string | null>(null);

  // Which call kinds actually appear in the loaded rows, in KIND_LABEL's
  // declared order — drives the filter tabs below. A page with recordings
  // from 8 possible kinds otherwise has no way to narrow the list.
  const kindsPresent = Object.keys(KIND_LABEL).filter((k) => rows.some((r) => r.call_kind === k));

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    // No client-side kind/role filtering here on purpose -- RLS
    // (public.user_can_view_call_transcript) is the sole authorization
    // boundary and decides what this query actually returns. For
    // meeting/event/sound_stage/speed_session/curated_stage rows that means
    // HOST-ONLY: this page will only ever show a stage/meeting/event
    // recording to the user who hosted it, by design (see the migration
    // 20260915100000_document_call_transcript_host_only_visibility.sql for
    // the full rationale). project/direct/circle rows are additionally
    // visible to their participants.
    const { data, error } = await supabase
      .from("call_transcripts")
      .select("id, call_kind, status, duration_seconds, created_at, recording_id, project_id, summary")
      .not("recording_id", "is", null)
      // Exclude recordings purge-expired-recordings has already deleted from
      // Daily (see _shared/recordingRetention.ts) -- their recording_url is
      // gone, so "Watch replay" would just fail; the transcript/summary
      // stays queryable elsewhere, this page is specifically about playable
      // recordings.
      .is("recording_deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("[Recordings]", error);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load().catch((e) => {
      console.error("[Recordings]", e);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-daily-recordings", {
        body: { limit: 50 },
      });
      if (error) throw error;
      const results = (data as any)?.results ?? [];
      const added = results.filter((r: any) => r.transcript_id && !r.skipped).length;
      sonnerToast.success(
        added > 0 ? `Pulled ${added} new recording${added === 1 ? "" : "s"}` : "All caught up",
        { description: `Scanned ${(data as any)?.scanned ?? 0} recent recordings from Daily.` },
      );
      await load();
    } catch (e: any) {
      sonnerToast.error("Couldn't sync", { description: e?.message || "Try again in a moment." });
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="min-h-dvh bg-background pb-24">
      <Helmet>
        <title>Call Recordings · Kretopia</title>
        <meta name="description" content="Watch replays, read transcripts and pull action items from your Kretopia video calls." />
      </Helmet>

      <FeaturePageHeader
        eyebrow="Call recordings"
        title="Recordings."
        accentTitle="Every call, revisited."
        subtitle="Replays, transcripts, and Kreto-extracted action items from every recorded call."
        tutorial={{ featureKey: "recordings", label: "How Recordings works", steps: RECORDINGS_TUTORIAL }}
      />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <KretoTip compact />
      </div>

      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          to="/messages"
          className="inline-flex items-center gap-1 h-8 px-2 -ml-2 rounded-md text-xs text-muted-foreground hover:text-[hsl(var(--energy))] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <Button type="button" size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5 shrink-0">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground px-4 pt-3">
        Recordings finalize ~1 min after a call ends. Tap Sync now to pull the latest.
      </p>

      <div className="px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Loading…</p>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center rounded-2xl shadow-none border-dashed border-border/60">
            <FileVideo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold text-sm">No recordings yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              During any Kretopia call, tap <b>Record</b>. When it ends, the replay, transcript
              and action items land here.
            </p>
          </Card>
        ) : kindsPresent.length <= 1 ? (
          // Only one call kind in the list (or none) — a filter would just
          // be a single useless tab, so skip straight to the flat list.
          <RecordingsList rows={rows} onRecap={setRecapId} />
        ) : (
          <StudioSectionTabs
            queryParam="kind"
            tabs={[
              { id: "all", label: "All", content: <RecordingsList rows={rows} onRecap={setRecapId} /> },
              ...kindsPresent.map((kind) => ({
                id: kind,
                label: KIND_LABEL[kind] ?? kind,
                content: <RecordingsList rows={rows.filter((r) => r.call_kind === kind)} onRecap={setRecapId} />,
              })),
            ]}
          />
        )}
      </div>

      <CallRecapSheet
        open={!!recapId}
        onOpenChange={(o) => !o && setRecapId(null)}
        transcriptId={recapId}
      />
    </div>
  );
}

function RecordingsList({ rows, onRecap }: { rows: Row[]; onRecap: (id: string) => void }) {
  if (rows.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">No recordings in this category.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const dur = fmtDur(r.duration_seconds);
        const kindLabel = KIND_LABEL[r.call_kind] ?? r.call_kind;
        const processing = r.status === "pending" || r.status === "transcribing";
        return (
          <Card key={r.id} className="p-4 flex items-start gap-3 rounded-2xl shadow-none border-border/60">
            <span className="h-10 w-10 rounded-xl bg-[hsl(var(--energy)/0.12)] flex items-center justify-center shrink-0">
              <Video className="h-4 w-4" style={{ color: "hsl(var(--energy))" }} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-sm font-semibold">{kindLabel}</p>
                {processing ? (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    Kreto listening…
                  </Badge>
                ) : r.status === "ready" ? (
                  <Badge className="h-4 px-1.5 text-[10px] bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-0">
                    Ready
                  </Badge>
                ) : r.status === "failed" ? (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                    Failed
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                {dur && <span>· {dur}</span>}
              </p>
              {r.summary && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{r.summary}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <WatchReplayButton
                  transcriptId={r.id}
                  title={kindLabel}
                  subtitle={`${formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}${dur ? ` · ${dur}` : ""}`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={() => onRecap(r.id)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Recap
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
