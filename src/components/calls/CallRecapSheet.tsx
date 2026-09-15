import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WatchReplayButton } from "@/components/calls/WatchReplayButton";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  X,
  ListChecks,
  FileText,
  ScrollText,
  Brain,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcriptId: string | null;
}

type Transcript = {
  id: string;
  status: "pending" | "transcribing" | "ready" | "failed";
  transcript: string | null;
  summary: string | null;
  language: string | null;
  duration_seconds: number | null;
  participants: any[];
  created_at: string;
  error: string | null;
  call_kind: "project" | "direct" | "circle";
  project_id: string | null;
};

type ActionItem = {
  id: string;
  kind: "task" | "credit" | "note" | "followup" | "decision";
  title: string;
  detail: string | null;
  assignee_name: string | null;
  status: "pending" | "accepted" | "dismissed" | "pushed";
};

const RECAP_KIND_LABEL: Record<Transcript["call_kind"], string> = {
  project: "Studio call",
  direct: "1:1 call",
  circle: "Circle call",
};

const KIND_META: Record<ActionItem["kind"], { label: string; icon: any; color: string }> = {
  task:     { label: "Task",      icon: ListChecks, color: "bg-primary/15 text-primary" },
  credit:   { label: "Credit",    icon: Sparkles,   color: "bg-amber-500/15 text-amber-600" },
  decision: { label: "Decision",  icon: CheckCircle2, color: "bg-emerald-500/15 text-emerald-600" },
  followup: { label: "Follow-up", icon: ScrollText, color: "bg-primary/15 text-primary" },
  note:     { label: "Note",      icon: FileText,   color: "bg-muted text-muted-foreground" },
};

export const CallRecapSheet = ({ open, onOpenChange, transcriptId }: Props) => {
  const { toast } = useToast();
  const [t, setT] = useState<Transcript | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !transcriptId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      // Authorization is enforced entirely by RLS
      // (public.user_can_view_call_transcript) -- this component has no
      // role/host check of its own. For stage/meeting/event transcripts
      // that RLS predicate is host-only by design (see
      // supabase/migrations/20260915100000_document_call_transcript_host_only_visibility.sql),
      // so a non-host opening this sheet for one of those simply gets no row
      // back (tRow stays null) rather than a 403.
      const [{ data: tRow }, { data: aRows }] = await Promise.all([
        supabase.from("call_transcripts").select("*").eq("id", transcriptId).maybeSingle(),
        supabase.from("call_action_items").select("*").eq("transcript_id", transcriptId).order("created_at"),
      ]);
      if (!mounted) return;
      setT((tRow as Transcript) ?? null);
      setItems((aRows as ActionItem[]) ?? []);
      setLoading(false);
    };
    void load().catch((e) => {
      console.error("[CallRecapSheet load]", e);
      setLoading(false);
    });

    // Realtime: poll-style refresh while still transcribing
    const channel = supabase
      .channel(`call-recap-${transcriptId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_transcripts", filter: `id=eq.${transcriptId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_action_items", filter: `transcript_id=eq.${transcriptId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [open, transcriptId]);

  const accept = async (item: ActionItem) => {
    setPushingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("accept-call-action-item", {
        body: { action_item_id: item.id },
      });
      if (error) throw error;
      toast({
        title: "Added",
        description:
          data?.pushed_to_kind === "project_tasks" ? "Task created in this project."
          : data?.pushed_to_kind === "project_notes" ? "Note saved to this project."
          : "Marked as actioned.",
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "pushed" } : i)));
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setPushingId(null);
    }
  };

  const dismiss = async (item: ActionItem) => {
    const { error } = await supabase
      .from("call_action_items")
      .update({ status: "dismissed" })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Couldn't dismiss", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "dismissed" } : i)));
  };

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const isProcessing = t?.status === "pending" || t?.status === "transcribing";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0 text-left flex-1">
              <SheetTitle className="text-sm font-semibold truncate">Call Recap</SheetTitle>
              <p className="text-[11px] text-muted-foreground">
                {t?.created_at ? formatDistanceToNow(new Date(t.created_at), { addSuffix: true }) : ""}
                {t?.duration_seconds ? ` · ${Math.round(t.duration_seconds / 60)} min` : ""}
                {pendingCount > 0 ? ` · ${pendingCount} to review` : ""}
              </p>
            </div>
            {transcriptId && (
              <WatchReplayButton
                transcriptId={transcriptId}
                title={t ? RECAP_KIND_LABEL[t.call_kind] : undefined}
                subtitle={
                  t?.created_at
                    ? `${formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}${t.duration_seconds ? ` · ${Math.round(t.duration_seconds / 60)}m` : ""}`
                    : undefined
                }
              />
            )}
          </div>
        </SheetHeader>


        {loading && !t ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !t ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Recap not found.
          </div>
        ) : isProcessing ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-medium">Kreto is listening…</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Transcribing the call and pulling out action items. This usually takes 1–3 minutes after the call ends.
            </p>
          </div>
        ) : t.status === "failed" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-destructive">Couldn't process this recording</p>
            <p className="text-xs text-muted-foreground">{t.error ?? "Unknown error"}</p>
          </div>
        ) : (
          <Tabs defaultValue="actions" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-3 self-start">
              <TabsTrigger value="actions" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Actions
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-full px-4 py-3">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No action items detected.
                  </p>
                ) : (
                  <ul className="space-y-2 pb-6">
                    {items.map((item) => {
                      const meta = KIND_META[item.kind];
                      const Icon = meta.icon;
                      const isDone = item.status === "pushed" || item.status === "dismissed";
                      return (
                        <li
                          key={item.id}
                          className={`rounded-lg border p-3 transition-opacity ${isDone ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${meta.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                  {meta.label}
                                </span>
                                {item.assignee_name && (
                                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                                    {item.assignee_name}
                                  </Badge>
                                )}
                                {item.status === "pushed" && (
                                  <Badge className="h-4 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 border-0">
                                    Added
                                  </Badge>
                                )}
                                {item.status === "dismissed" && (
                                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">Dismissed</Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium leading-snug">{item.title}</p>
                              {item.detail && (
                                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                                  {item.detail}
                                </p>
                              )}
                              {!isDone && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs"
                                    disabled={pushingId === item.id}
                                    onClick={() => accept(item)}
                                  >
                                    {pushingId === item.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : item.kind === "task" ? "Add to project" : "Save"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    onClick={() => dismiss(item)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="summary" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-full px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap pb-6">
                  {t.summary ?? "No summary available."}
                </p>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="transcript" className="flex-1 min-h-0 m-0">
              <ScrollArea className="h-full px-4 py-3">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans pb-6">
                  {t.transcript ?? "No transcript available."}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
};
