import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Square, Loader2, X, ArrowRight, Sparkles, Maximize2,
  MessageSquareText, FileEdit, Rocket, Upload, Link2, ShieldCheck,
  Wand2, FolderPlus, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaButton } from "@/components/ui/cta-button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { KretoCharacter, type KretoCharacterState } from "@/components/brand/KretoCharacter";
import { HoloCard } from "@/components/passport/HoloCard";
import { FunnelStepper, type FunnelStep } from "@/components/onboarding/FunnelStepper";
import { FeatureAITutorial } from "@/components/features/FeatureAITutorial";
import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { NewRoomLaunchScreen } from "@/components/project/studio/NewRoomLaunchScreen";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { WORKSPACE_CONFIGS, type WorkspaceType } from "@/lib/workspaceConfigs";
import { compressImage } from "@/lib/extractBriefDocument";
import { inferWorkspaceType } from "@/lib/inferWorkspaceType";
import { getNewRoomCautionReasons } from "@/lib/newRoomCaution";
import { analytics } from "@/lib/analytics";


/** Real example prompts per workspace type — the same examples already used
 * as placeholder text, promoted to visible, tappable chips so they teach by
 * example instead of disappearing the moment someone starts typing. */
const EXAMPLE_PROMPTS: Record<WorkspaceType, string> = {
  event_production: "Bali Carnival — 2-day beach festival, Aug 2026, 5k guests, 3 stages.",
  music_project: "Debut EP — 5 tracks, summer release, lo-fi beats with vocal features.",
  brand_collab: "Spring brand launch for Acme — paid + organic across IG, TikTok, YouTube.",
  photo_shoot: "Editorial shoot — 3 looks, 2 models, studio + rooftop, deliver in 10 days.",
  video_shoot: "A 60-second product reel for Acme. Moody, fast cuts. Shoot Friday.",
  content_series: "Weekly podcast — 8 episodes, guest interviews, publish every Thursday.",
  fashion_show: "Runway show — 12 looks, 6 models, backstage roll call at 6pm.",
  commissioned_art: "Custom illustration — client portrait, digital, 2 revision rounds.",
  dj_live_gig: "3-hour opening set, house/techno, Saturday night, load-in at 8.",
  edit_job: "Color grade a 10-minute short film, deliver by next Friday.",
  general: "A 60-second product reel for Acme. Moody, fast cuts. Shoot Friday.",
};

/** New Room's own "How this works" tour -- now rendered through the same
 * shared FeatureAITutorial/FeatureTutorial engine every other overhauled
 * feature page uses (Studio, Perks, Manage Opportunities, Creative Circle),
 * instead of the bespoke <details> disclosure this modal used to build by
 * hand. */
const TUTORIAL_STEPS: TutorialStep[] = [
  { icon: MessageSquareText, title: "Tell Kreto what you're making", body: "Speak, type, upload a brief or paste a sheet." },
  { icon: Wand2, title: "Kreto identifies the type", body: "Photo shoot, campaign, music, event — inferred from what you said." },
  { icon: Sparkles, title: "Kreto drafts the brief & tasks", body: "A title, summary and starter tasks, structured for the room type." },
  { icon: FileEdit, title: "You review and edit", body: "Every field stays editable — title, tasks, type, dates, budget." },
  { icon: CheckCircle2, title: "You confirm the Project", body: "Nothing is written to your Studio until you tap Create." },
  { icon: Rocket, title: "Your room opens", body: "With one clear next action, ready to work in." },
  { icon: FolderPlus, title: "Work becomes Project memory", body: "Files and decisions you add later feed the Studio Brain." },
  { icon: ShieldCheck, title: "Credits & invoice at wrap", body: "Drafted for review when supported — never sent automatically." },
];

/** New Room's own funnel steps -- same FunnelStepper component and visual
 * treatment as Onboarding's Sign up / First Stamp / Launch Passport. */
const NEW_ROOM_STEPS: FunnelStep[] = [
  { key: "describe", label: "Describe" },
  { key: "review", label: "Review" },
  { key: "create", label: "Create" },
];

/** Contextual copy cycled through while Kreto drafts the brief — real
 * pipeline stages (extract → structure → seed tasks), not a generic
 * "loading…" — paced on a timer since the actual extract-brief call is a
 * single request/response with no intermediate progress to report. */
const THINKING_STEPS = [
  "Reading what you shared",
  "Sketching the brief",
  "Mapping the first tasks",
  "Almost ready",
];

interface VoiceFirstCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  /** When provided, shows a "expand to full page" affordance in the top bar
   *  that calls this instead of navigating internally -- lets a caller
   *  route to New Room's own full-page URL (see NewRoomPage.tsx) while
   *  preserving the in-progress draft via the existing sessionStorage
   *  hydration. Omitted entirely (no button shown) when already rendered
   *  as the full page itself. */
  onExpand?: () => void;
}

type Mode = "prompt" | "recording" | "thinking" | "review" | "error";

interface ExtractedBrief {
  project: { title: string; summary: string };
  deliverables?: Array<{ title: string; description?: string; due_date?: string | null }>;
}

/**
 * Full-screen "What are you making?" entry. Voice-first, with a single
 * text fallback on the same screen. Uses extract-brief to seed the new
 * project's title + description.
 */
export const VoiceFirstCreateModal = ({
  open,
  onOpenChange,
  onCreated,
  onExpand,
}: VoiceFirstCreateModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>("prompt");
  const [textInput, setTextInput] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [creating, setCreating] = useState(false);
  // Synchronous guard against a duplicate project on a fast double-click or
  // double-tap: React state updates (the `creating` flag disabling the
  // button) are batched and lag a render behind the actual click handler,
  // so two clicks fired close enough together can both read `creating` as
  // still false. A ref updates immediately, closing that race. This does
  // not cover a network retry after a genuinely lost response (that needs
  // a server-side idempotency key -- see NEW_ROOM_APPROVAL_AND_SECURITY.md)
  // but it closes the far more common double-click case without a migration.
  const creatingRef = useRef(false);
  const [brief, setBrief] = useState<ExtractedBrief | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [paymentsInvolved, setPaymentsInvolved] = useState<boolean | null>(null);
  const [trackAsCredit, setTrackAsCredit] = useState<boolean>(false);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>("general");
  const [rawInput, setRawInput] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  // Kreto embodied-presence state (KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md) --
  // every field below is a real, independently-observable signal, never a
  // fabricated one: composerFocused is real DOM focus, isOffline mirrors the
  // browser's own online/offline events, errorInfo/creationError are only
  // ever set inside a real catch block, and draftDegraded is only set when
  // extract-brief genuinely failed and the app fell back to raw text.
  const [composerFocused, setComposerFocused] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));
  const [errorInfo, setErrorInfo] = useState<{ message: string; retryTo: "prompt" | "link" } | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [draftDegraded, setDraftDegraded] = useState(false);
  // The "your room is live" celebration (NewRoomLaunchScreen) -- set only
  // once createProject()'s real insert has succeeded, mirroring
  // Onboarding's ProfileLaunchScreen pattern instead of the previous
  // silent setTimeout(navigate) close.
  const [createdProject, setCreatedProject] = useState<{ id: string; title: string; taskCount: number } | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // A review-step draft (title/summary/type/deadline/budget/payments/credit)
  // survives a refresh or an accidental close — nothing here is saved to the
  // DB until "Create". Recording audio itself is NOT persisted (can't
  // serialize a live MediaRecorder stream to sessionStorage), only the
  // brief once extracted. Same pattern as Onboarding.tsx's draft.
  const draftKey = user ? `new_room_draft:${user.id}` : null;
  const hydratedRef = useRef(false);

  // Reset on close, but restore a fresh-enough draft on open instead of
  // always starting blank.
  useEffect(() => {
    if (!open) {
      stopTimer();
      mediaRef.current?.stream?.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      chunksRef.current = [];
      setMode("prompt");
      setTextInput("");
      setSeconds(0);
      setBrief(null);
      setSelected(new Set());
      setCreating(false);
      setPaymentsInvolved(null);
      setTrackAsCredit(false);
      setWorkspaceType("general");
      setRawInput("");
      setDeadline("");
      setBudget("");
      setShowLinkInput(false);
      setLinkUrl("");
      setUploadingFile(false);
      setComposerFocused(false);
      setErrorInfo(null);
      setCreationError(null);
      setDraftDegraded(false);
      setCreatedProject(null);
      hydratedRef.current = false;
      return;
    }
    if (!draftKey) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        const isFresh = draft.ts && Date.now() - draft.ts < 24 * 60 * 60 * 1000;
        if (isFresh && draft.brief?.project?.title) {
          setBrief(draft.brief);
          setSelected(new Set(draft.selected ?? []));
          setWorkspaceType(draft.workspaceType ?? "general");
          setPaymentsInvolved(draft.paymentsInvolved ?? null);
          setTrackAsCredit(!!draft.trackAsCredit);
          setDeadline(draft.deadline ?? "");
          setBudget(draft.budget ?? "");
          setMode("review");
        } else if (!isFresh) {
          sessionStorage.removeItem(draftKey);
        }
      }
    } catch { /* corrupt draft — ignore, start fresh */ }
    hydratedRef.current = true;
  }, [open, draftKey]);

  // Save the review-step draft on every relevant change.
  useEffect(() => {
    if (!hydratedRef.current || !draftKey || mode !== "review" || !brief) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        ts: Date.now(),
        brief, selected: Array.from(selected), workspaceType,
        paymentsInvolved, trackAsCredit, deadline, budget,
      }));
    } catch { /* sessionStorage unavailable — draft just won't persist */ }
  }, [draftKey, mode, brief, selected, workspaceType, paymentsInvolved, trackAsCredit, deadline, budget]);

  const clearDraft = useCallback(() => {
    if (draftKey) { try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } }
  }, [draftKey]);

  // Cycle the thinking-state copy while Kreto drafts — resets to the first
  // line every time thinking mode starts.
  useEffect(() => {
    if (mode !== "thinking") { setThinkingStep(0); return; }
    const id = window.setInterval(
      () => setThinkingStep((i) => Math.min(i + 1, THINKING_STEPS.length - 1)),
      1400,
    );
    return () => window.clearInterval(id);
  }, [mode]);

  // Real browser connectivity, tracked only while New Room is actually open
  // -- not a guess, and no new network request (KRETO_HERO_NEW_ROOM_PERFORMANCE_REPORT.md's
  // "no new network request" rule). This reflects the browser's own network
  // interface state, which is the most honest signal available without
  // adding a request solely to probe reachability.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [open]);

  const startTimer = () => {
    setSeconds(0);
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };
      rec.start();
      mediaRef.current = rec;
      analytics.newRoomInputModeSelected('voice');
      analytics.newRoomVoiceStarted();
      setMode("recording");
      startTimer();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Mic not available",
        description: "Type what you're making instead.",
      });
    }
  };

  const stopRecording = () => {
    stopTimer();
    analytics.newRoomVoiceCompleted(seconds);
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setMode("thinking");
  };

  /** supabase-js's functions.invoke() error only ever says "Edge Function
   * returned a non-2xx status code" -- the function's own real error
   * message lives in the response body, on err.context (the raw Response),
   * which invoke() never reads for you. Without this, every failure here
   * -- a rate limit, a bad file, credits exhausted -- looked identical and
   * meaningless to the user ("an Edge Function error"), regardless of the
   * actual cause. */
  const describeFunctionError = async (err: any, fallback: string): Promise<string> => {
    try {
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await (typeof ctx.clone === "function" ? ctx.clone() : ctx).json().catch(() => null);
        const msg = body?.error || body?.message;
        if (typeof msg === "string" && msg.trim()) return msg;
      }
    } catch { /* fall through to fallback */ }
    const generic = err?.message === "Edge Function returned a non-2xx status code";
    return !generic && err?.message ? err.message : fallback;
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const processAudio = async (blob: Blob) => {
    setDraftDegraded(false);
    try {
      const data_base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "audio", data_base64, mime_type: "audio/webm", workspace_type: workspaceType },
      });
      if (error) throw error;
      const result = (data ?? {}) as ExtractedBrief;
      if (!result?.project?.title) throw new Error("Couldn't catch what you said");
      setBrief(result);
      setSelected(new Set((result.deliverables ?? []).slice(0, 8).map((_, i) => i)));
      // Only auto-infer if user hadn't picked a type
      if (workspaceType === "general") {
        setWorkspaceType(inferWorkspaceType(`${result.project.title} ${result.project.summary}`));
      }
      analytics.newRoomDraftReady(workspaceType, (result.deliverables ?? []).length);
      setMode("review");
    } catch (err: any) {
      console.error(err);
      analytics.newRoomCreationFailed("voice_extract");
      setErrorInfo({
        message: await describeFunctionError(
          err,
          "Kreto couldn't catch what you said. Try again or type it instead.",
        ),
        retryTo: "prompt",
      });
      setMode("error");
    }
  };

  const submitText = async () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    setRawInput(trimmed);
    setDraftDegraded(false);
    analytics.newRoomInputModeSelected('text');
    setMode("thinking");
    // If user hasn't picked a type yet, infer one before calling extract-brief
    // so the AI uses the right producer persona.
    const typeForCall: WorkspaceType =
      workspaceType !== "general" ? workspaceType : inferWorkspaceType(trimmed);
    if (typeForCall !== workspaceType) setWorkspaceType(typeForCall);
    analytics.newRoomTextSubmitted(typeForCall);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "text", text: trimmed, workspace_type: typeForCall },
      });
      if (error) throw error;
      const result = (data ?? {}) as ExtractedBrief;
      const finalBrief: ExtractedBrief = !result?.project?.title
        ? { project: { title: trimmed.slice(0, 60), summary: trimmed } }
        : result;
      setBrief(finalBrief);
      setSelected(new Set((finalBrief.deliverables ?? []).slice(0, 8).map((_, i) => i)));
      analytics.newRoomDraftReady(typeForCall, (finalBrief.deliverables ?? []).length);
      setMode("review");
    } catch (err: any) {
      console.error(err);
      // Don't block — let them proceed with raw text, but say why Kreto
      // couldn't elevate it instead of failing silently.
      const reason = await describeFunctionError(err, "");
      if (reason) {
        toast({ title: "Kreto couldn't expand that", description: reason });
      }
      setBrief({
        project: {
          title: trimmed.slice(0, 60),
          summary: trimmed,
        },
      });
      setSelected(new Set());
      setDraftDegraded(true);
      setMode("review");
    }
  };

  /** "Upload a brief or file" — real capability, not a stub: extract-brief
   * already supports source="doc" (base64 PDF/image, Gemini multimodal),
   * it just wasn't wired up in this modal before now. */
  const processFile = async (file: File) => {
    analytics.newRoomInputModeSelected('file');
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max 25 MB — try a smaller export or a photo instead of the original file.",
        variant: "destructive",
      });
      return;
    }
    setUploadingFile(true);
    setDraftDegraded(false);
    analytics.newRoomFileUploaded(file.type || 'unknown');
    setMode("thinking");
    try {
      // Images go through the same compress-before-send step BriefDropZone
      // already uses (resize to <=1280px, re-encode as JPEG) -- an
      // uncompressed phone photo can be 10-20MB, which is a real, silent
      // cause of intermittent upload failures.
      const isImage = file.type.startsWith("image/");
      const { base64: data_base64, mime: mime_type } = isImage
        ? await compressImage(file)
        : { base64: await blobToBase64(file), mime: file.type || "application/pdf" };
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: {
          source: "doc",
          data_base64,
          mime_type,
          workspace_type: workspaceType,
        },
      });
      if (error) throw error;
      const result = (data ?? {}) as ExtractedBrief;
      if (!result?.project?.title) throw new Error("Couldn't read that file");
      setBrief(result);
      setSelected(new Set((result.deliverables ?? []).slice(0, 8).map((_, i) => i)));
      if (workspaceType === "general") {
        setWorkspaceType(inferWorkspaceType(`${result.project.title} ${result.project.summary}`));
      }
      analytics.newRoomDraftReady(workspaceType, (result.deliverables ?? []).length);
      setMode("review");
    } catch (err: any) {
      console.error(err);
      analytics.newRoomCreationFailed('file_extract');
      setErrorInfo({
        message: await describeFunctionError(err, "Kreto couldn't read that file. Try pasting the brief as text instead."),
        retryTo: "prompt",
      });
      setMode("error");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processFile(file);
  };

  /** "Paste a link" — scoped honestly to what extract-brief's source="sheet"
   * actually supports: a public Google Sheet, one row per deliverable. Not
   * arbitrary URL scraping. */
  const submitLink = async () => {
    const url = linkUrl.trim();
    if (!url) return;
    analytics.newRoomInputModeSelected('link');
    analytics.newRoomLinkSubmitted();
    setDraftDegraded(false);
    setMode("thinking");
    try {
      const { data, error } = await supabase.functions.invoke("extract-brief", {
        body: { source: "sheet", url, workspace_type: workspaceType },
      });
      if (error) throw error;
      const result = (data ?? {}) as ExtractedBrief;
      if (!result?.project?.title) throw new Error("Couldn't read that sheet");
      setBrief(result);
      setSelected(new Set((result.deliverables ?? []).slice(0, 8).map((_, i) => i)));
      analytics.newRoomDraftReady(workspaceType, (result.deliverables ?? []).length);
      setMode("review");
    } catch (err: any) {
      console.error(err);
      analytics.newRoomCreationFailed('link_extract');
      setErrorInfo({
        message: await describeFunctionError(
          err,
          "Kreto couldn't read that link. Make sure the Google Sheet is shared as \"Anyone with the link.\"",
        ),
        retryTo: "link",
      });
      setMode("error");
    }
  };

  const createProject = async (mode: "all" | "selected" | "none" = "all") => {
    if (!user || !brief) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreationError(null);
    analytics.newRoomProjectConfirmed(workspaceType);
    setCreating(true);
    try {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          title: brief.project.title.slice(0, 120),
          description: brief.project.summary || null,
          created_by: user.id,
          status: "active",
          workspace_type: workspaceType,
          deal_type: paymentsInvolved ? "paid" : "personal",
          track_as_credit: trackAsCredit,
          deadline: deadline || null,
          budget: budget.trim() || null,
          setup_completed: false,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: engagementError } = await supabase.from("engagements").insert({
        project_id: project.id,
        mode: "direct",
        created_by: user.id,
      });
      if (engagementError) console.error("[NewRoom] engagement insert failed", engagementError);

      // Pick which deliverables to seed
      const all = (brief.deliverables ?? []).slice(0, 8);
      const picked =
        mode === "all"
          ? all
          : mode === "selected"
          ? all.filter((_, i) => selected.has(i))
          : [];

      if (picked.length) {
        const rows = picked.map((d) => ({
          project_id: project.id,
          title: d.title.slice(0, 200),
          description: d.description ?? null,
          status: "todo",
          created_by: user.id,
        }));
        try {
          await supabase.from("project_tasks").insert(rows);
        } catch (e) {
          console.warn("seed tasks failed", e);
        }
      }

      // Scaffold default Vault folders + starter deliverables (skip tasks if AI seeded any)
      try {
        const { scaffoldProjectDefaults } = await import("@/lib/scaffoldProject");
        await scaffoldProjectDefaults({
          projectId: project.id,
          workspaceType,
          userId: user.id,
          skipTasks: picked.length > 0,
        });
      } catch (e) {
        console.warn("scaffold defaults failed", e);
      }

      try {
        const { analytics } = await import("@/lib/analytics");
        analytics.projectCreated(project.id);
      } catch {
        /* non-fatal */
      }

      toast({ title: "Studio room ready" });
      clearDraft();
      // Show the celebration (NewRoomLaunchScreen) instead of navigating
      // away immediately -- onCreated()/onOpenChange(false)/navigate() now
      // fire from handleLaunchRoom() once the user is done there, mirroring
      // Onboarding's ProfileLaunchScreen pattern. Deliberately does NOT
      // close this modal yet: several callers' onCreated also flips their
      // own `open` state, which would otherwise unmount this component
      // (and the celebration with it) the instant the insert succeeds.
      setCreatedProject({ id: project.id, title: brief.project.title, taskCount: picked.length });
    } catch (err: any) {
      console.error(err);
      analytics.newRoomCreationFailed('project_insert');
      setCreationError(err?.message || "Couldn't open the room. Try again.");
      toast({
        title: "Couldn't open the room",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  /** The only exit from the celebration screen -- clicking "Open the room",
   * dismissing the dialog (Escape/overlay click), all funnel to the same
   * real navigation, since the project already exists at this point either way. */
  const handleLaunchRoom = () => {
    if (!createdProject) return;
    const id = createdProject.id;
    onCreated();
    onOpenChange(false);
    // Real route state, not a query param -- it never reaches the URL, so
    // it can't be bookmarked, shared or hand-typed to spoof the
    // acknowledgement on an unrelated visit (KRETO_NEW_ROOM_INTEGRATION_REPORT.md's
    // approved design). Only ever set here, right after a real insert
    // succeeded.
    navigate(`/desk/${id}`, { state: { kretoJustCreated: true } });
  };

  // This is a full-screen custom overlay, not a Radix Dialog, so Escape
  // handling, a focus trap and focus return -- all free with Dialog --
  // have to be built by hand here.
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // While the celebration Dialog is up, let its own Escape handling
      // (wired to handleLaunchRoom via onOpenChange below) own this key --
      // this listener closing the outer overlay directly would skip the
      // navigate-to-room step and leave the user on a dead blank screen.
      if (createdProject) return;
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      // Manual focus trap: Tab/Shift+Tab wraps within the modal instead of
      // escaping into the page behind it, which a bare `role="dialog"` div
      // (unlike Radix Dialog) does nothing to prevent on its own.
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, createdProject]);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
      analytics.newRoomOpened('desk');
    } else {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  if (!open && !createdProject) return null;

  const fmtSec = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Review-step Kreto state: a real creation failure always takes priority
  // (it's the most urgent thing to surface), otherwise caution only when a
  // real unresolved detail exists (KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md's
  // approved decision) -- never for an ordinary clean draft.
  const otherCautionReasons = getNewRoomCautionReasons(workspaceType, draftDegraded);
  const noDeliverables = !brief?.deliverables || brief.deliverables.length === 0;
  const reviewNeedsCaution = otherCautionReasons.length > 0 || noDeliverables;
  const reviewState: KretoCharacterState = creationError ? "error" : reviewNeedsCaution ? "caution" : "proposal_ready";

  // Same 3-step language as Onboarding's FunnelStepper: describe -> review
  // -> create. "create" only lights up during the actual creating request
  // (or once the celebration is showing) -- everything else, including a
  // mid-flight extraction error, is still "describe" until a brief exists.
  const currentStep = creating || createdProject
    ? "create"
    : mode === "review"
      ? "review"
      : "describe";

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[60] overflow-y-auto bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-room-title"
    >
      {/* Ambient accents — same recipe as Onboarding's centered HoloCard shell */}
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent pointer-events-none" />
      <div className="absolute top-20 -left-32 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-32 w-64 h-64 rounded-full bg-[hsl(var(--energy)/0.05)] blur-3xl pointer-events-none" />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*,.doc,.docx"
        className="hidden"
        onChange={handleFilePick}
      />

      <HoloCard className="w-full max-w-lg relative z-10 my-8">
        <div className="relative flex flex-col max-h-[85vh] overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-xl shadow-primary/5">
          {/* Top bar */}
          <div className="relative z-10 flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border/40">
            <span
              id="new-room-title"
              className="text-xs font-bold tracking-[0.22em] uppercase text-[hsl(var(--energy))] shrink-0"
            >
              New Room
            </span>
            <FunnelStepper current={currentStep} steps={NEW_ROOM_STEPS} className="max-w-[220px] mx-auto hidden sm:block" />
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              {onExpand && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onExpand}
                  aria-label="Expand to full page"
                  title="Expand to full page"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                ref={closeButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className={cn(
            "relative z-10 flex-1 flex flex-col items-center px-6 text-center overflow-y-auto overscroll-contain",
            mode === "review" ? "justify-start py-6 pb-32" : "justify-center py-10"
          )}>


        {mode === "prompt" && (
          <>
            <KretoCharacter
              size={96}
              className="mb-4"
              state={isOffline ? "offline" : composerFocused || showLinkInput ? "attentive" : "idle"}
            />
            <h1 className="landing-h1 landing-glow text-3xl sm:text-4xl mb-3 leading-[1.05]">
              What are you <span className="landing-accent">making?</span>
            </h1>
            {isOffline && (
              <p role="status" className="text-xs font-semibold text-muted-foreground mb-3">
                You're offline — reconnect before Kreto can read a brief.
              </p>
            )}
            <p className="landing-sub max-w-sm mb-3 text-sm">
              Share what you're working on — voice, text, a file or a link. Kreto drafts the
              brief, starter tasks and room type for you to review.
            </p>

            {/* Trust copy — required up front, not buried in a tooltip */}
            <p className="text-[11px] text-muted-foreground/80 max-w-md mb-4 leading-relaxed">
              Nothing becomes a Project until you confirm the draft. Kreto will not invite
              collaborators, send messages or emails, or trigger payments without your approval.
            </p>

            {/* How this works — same shared AI-tutorial engine every other
                overhauled feature page uses (Studio, Perks, Manage
                Opportunities, Creative Circle), not a bespoke disclosure. */}
            <FeatureAITutorial
              featureKey="new-room"
              label="How New Room works"
              steps={TUTORIAL_STEPS}
              className="mb-6"
            />

            {showLinkInput ? (
              <div className="w-full max-w-md space-y-3">
                <div
                  className="rounded-2xl border p-4 text-left"
                  style={{ borderColor: "hsl(var(--energy) / 0.25)", boxShadow: "0 0 0 1px hsl(var(--energy) / 0.08)" }}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "hsl(var(--energy))" }}>
                    Google Sheet link
                  </p>
                  <Input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Share it as "Anyone with the link can view" — one row per deliverable.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setShowLinkInput(false); setLinkUrl(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <Button onClick={submitLink} disabled={!linkUrl.trim()} className="gap-1">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                {/* Unified Kreto composer — one persistent search-bar-styled
                    entry point instead of a giant mic circle that hid text
                    entry behind an extra "Or type it instead" click. Typing
                    + Enter/the arrow button talks to Kreto in text; the mic
                    icon lives inside the bar as a secondary affordance, same
                    visual language as UnifiedSearchDropdown's hero variant
                    (the app's own canonical search bar) instead of a
                    bespoke shape. */}
                <div className="relative">
                  <Sparkles
                    aria-hidden
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "hsl(var(--energy))" }}
                  />
                  <input
                    type="text"
                    autoFocus
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && textInput.trim()) {
                        e.preventDefault();
                        submitText();
                      }
                    }}
                    placeholder={`Describe it to Kreto — e.g. "${EXAMPLE_PROMPTS[workspaceType]}"`}
                    aria-label="Describe your project to Kreto"
                    className="w-full h-14 rounded-2xl border bg-card/80 backdrop-blur-sm pl-11 pr-24 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all"
                    style={{ borderColor: "hsl(var(--energy) / 0.25)" }}
                  />
                  <button
                    type="button"
                    onClick={startRecording}
                    aria-label="Describe it by voice instead"
                    title="Talk to Kreto"
                    className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={submitText}
                    disabled={!textInput.trim()}
                    aria-label="Send to Kreto"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: "hsl(var(--energy))" }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* More ways to start — real, distinct capabilities, not
                    stickers: extract-brief already supports source="doc"
                    (upload) and source="sheet" (Google Sheet link), just
                    newly wired up here. */}
                <div className="mt-6 w-full">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    More ways to start
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="glass-surface rounded-xl p-3 text-left hover:border-primary/40 transition-colors disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4 mb-1.5" style={{ color: "hsl(var(--energy))" }} />
                      <p className="text-xs font-semibold leading-tight">Start from a brief or file</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        PDF, image or doc — Kreto reads it.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLinkInput(true)}
                      className="glass-surface rounded-xl p-3 text-left hover:border-primary/40 transition-colors"
                    >
                      <Link2 className="h-4 w-4 mb-1.5" style={{ color: "hsl(var(--energy))" }} />
                      <p className="text-xs font-semibold leading-tight">Paste a Google Sheet</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        One row per deliverable — Kreto maps it.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {mode === "recording" && (
          <>
            <KretoCharacter size={72} state="listening" className="mb-5" />
            <div className="relative mb-8">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "hsl(var(--energy) / 0.25)" }}
              />
              <button
                type="button"
                onClick={stopRecording}
                aria-label="Stop recording"
                className="glass-surface-elevated relative h-28 w-28 rounded-full flex items-center justify-center"
                style={{
                  border: "1.5px solid hsl(var(--energy) / 0.4)",
                  boxShadow: "0 8px 40px hsl(var(--energy) / 0.22)",
                }}
              >
                <Square className="h-9 w-9 fill-current" style={{ color: "hsl(var(--energy))" }} />
              </button>
            </div>
            <p className="text-2xl font-mono tabular-nums">{fmtSec(seconds)}</p>
            <p className="text-sm text-muted-foreground mt-2">Tap to stop when you're done</p>
          </>
        )}

        {mode === "thinking" && (
          <div className="flex flex-col items-center">
            <KretoCharacter size={96} state="processing" />

            <div className="mt-7 h-7 relative w-full max-w-xs" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.p
                  key={thinkingStep}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.65, 0.3, 0.95] }}
                  className="absolute inset-0 text-base font-semibold text-foreground"
                >
                  {THINKING_STEPS[thinkingStep]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Indeterminate progress — gray-to-pink gradient sweep, no spinner */}
            <div className="mt-4 h-1 w-48 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className="h-full w-1/2 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, hsl(var(--energy)), transparent)" }}
                animate={reducedMotion ? undefined : { x: ["-100%", "200%"] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {mode === "error" && (
          <div className="flex flex-col items-center max-w-sm">
            <KretoCharacter size={96} state={isOffline ? "offline" : "error"} />
            <p className="mt-6 text-lg font-bold">
              {isOffline ? "You're offline" : "Kreto couldn't finish that draft."}
            </p>
            <p role="alert" className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {isOffline
                ? "Reconnect and try again — nothing you typed or recorded is lost."
                : errorInfo?.message || "Your input is still here. Try again or adjust the brief."}
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                const retryTo = errorInfo?.retryTo ?? "prompt";
                setErrorInfo(null);
                setMode("prompt");
                if (retryTo === "link") setShowLinkInput(true);
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {mode === "review" && brief && (
          <div className="w-full max-w-md space-y-5 text-left">
            <div className="flex items-center gap-3">
              <KretoCharacter size={56} state={reviewState} />
              <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "hsl(var(--energy))" }}>
                Kreto structured your project — review and edit
              </p>
            </div>

            {creationError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {creationError}
              </div>
            )}

            {otherCautionReasons.length > 0 && (
              <div role="status" className="rounded-lg border p-3 space-y-1" style={{ borderColor: "hsl(var(--warning) / 0.4)", backgroundColor: "hsl(var(--warning) / 0.06)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--warning))" }}>
                  Worth a look before you continue
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {otherCautionReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Project name
              </label>
              <input
                value={brief.project.title}
                onChange={(e) =>
                  setBrief({ ...brief, project: { ...brief.project, title: e.target.value } })
                }
                className="w-full bg-transparent text-xl font-bold outline-none border-b-2 border-border focus:border-primary pb-1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                The vision
              </label>
              <Textarea
                value={brief.project.summary}
                onChange={(e) =>
                  setBrief({ ...brief, project: { ...brief.project, summary: e.target.value } })
                }
                className="min-h-[100px] text-sm"
              />
            </div>
            {brief.deliverables && brief.deliverables.length > 0 ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    Starter tasks ({selected.size}/{Math.min(brief.deliverables.length, 8)})
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const all = brief.deliverables!.slice(0, 8);
                      setSelected(
                        selected.size === all.length
                          ? new Set()
                          : new Set(all.map((_, i) => i))
                      );
                    }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {selected.size === Math.min(brief.deliverables.length, 8)
                      ? "Clear all"
                      : "Select all"}
                  </button>
                </div>
                <ul className="space-y-1">
                  {brief.deliverables.slice(0, 8).map((d, i) => {
                    const checked = selected.has(i);
                    return (
                      <li key={i}>
                        <label className="flex items-start gap-2 py-1.5 px-1 rounded cursor-pointer hover:bg-primary/10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = new Set(selected);
                              if (checked) next.delete(i);
                              else next.add(i);
                              setSelected(next);
                            }}
                            className="mt-0.5 h-4 w-4 accent-primary shrink-0"
                          />
                          <span className={cn("text-sm leading-snug", !checked && "text-muted-foreground line-through")}>
                            {d.title}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Pick what to seed — you can always add more inside the room.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                We couldn't pull starter tasks from that. You can add them inside the room — or tap "Start over" and give a bit more detail.
              </div>
            )}

            {/* Workspace type — drives which Studio modules mount */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Room type
              </p>
              <p className="text-xs text-muted-foreground">
                {WORKSPACE_CONFIGS[workspaceType].description} Tap to change.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(WORKSPACE_CONFIGS) as WorkspaceType[]).map((t) => {
                  const cfg = WORKSPACE_CONFIGS[t];
                  const Icon = cfg.icon;
                  const active = workspaceType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setWorkspaceType(t)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border-2 transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payments involved? gate */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Money involved?
              </p>
              <p className="text-xs text-muted-foreground">
                If yes, we'll wire KrePay into the room — quotes, invoices, escrow.
                If no, we keep it clean.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentsInvolved(true)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-md text-sm font-bold border-2 transition-colors",
                    paymentsInvolved === true
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  Yes — paid work
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentsInvolved(false)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-md text-sm font-bold border-2 transition-colors",
                    paymentsInvolved === false
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  No — personal/passion
                </button>
              </div>
            </div>

            {/* Track as credit — opt-in */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Track as a credit?
              </p>
              <p className="text-xs text-muted-foreground">
                Turn on if this work is shareable — collaborators can be tagged
                and the project flows into your Stamps when finished. Leave off
                for private planning or personal notes.
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={trackAsCredit}
                  onChange={(e) => setTrackAsCredit(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">
                  Yes — this is shareable work
                </span>
              </label>
            </div>

            {/* Target date + budget — optional, both real project fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Target date
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Budget (optional)
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. $2,000"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {mode === "review" && brief && (
        <div className="shrink-0 border-t border-border/40 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-2 bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              analytics.newRoomDraftCancelled();
              setBrief(null);
              setSelected(new Set());
              setMode("prompt");
              clearDraft();
            }}
            disabled={creating}
          >
            Start over
          </Button>
          <div className="flex items-center gap-2">
            {brief.deliverables && brief.deliverables.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => createProject("selected")}
                disabled={creating || !brief.project.title.trim() || selected.size === 0 || paymentsInvolved === null}
                className="gap-1"
              >
                Create {selected.size} selected
              </Button>
            )}
            {/* The final, consequential confirm action -- promoted to the
                app's canonical primary-CTA treatment (same component as
                StudioCreateHero's "Open a New Room") instead of a plain
                size="sm" Button indistinguishable from "Start over"/
                "Create N selected" next to it. w-auto override keeps it
                from stretching full-width in this compact footer row,
                which CtaButton's own default width classes assume a
                standalone card slot, not a shared flex bar. */}
            <CtaButton
              onClick={() => createProject(brief.deliverables?.length ? "all" : "none")}
              disabled={creating || !brief.project.title.trim() || paymentsInvolved === null}
              className="w-auto gap-1.5 px-6"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {brief.deliverables?.length ? "Create all & open" : "Open the room"}
            </CtaButton>
          </div>
        </div>
      )}
        </div>
      </HoloCard>

      {createdProject && (
        <NewRoomLaunchScreen
          open
          onOpenChange={(o) => { if (!o) handleLaunchRoom(); }}
          projectId={createdProject.id}
          projectTitle={createdProject.title}
          workspaceType={workspaceType}
          taskCount={createdProject.taskCount}
          onOpenRoom={handleLaunchRoom}
        />
      )}
    </div>
  );
};
