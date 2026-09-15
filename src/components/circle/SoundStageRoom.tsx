import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Mic,
  MicOff,
  Hand,
  Radio,
  X,
  Users,
  Loader2,
  Video,
  VideoOff,
  Crown,
  MoreVertical,
  Captions,
  CaptionsOff,
  ScreenShare,
  ScreenShareOff,
  Circle,
  Square,
  Share2,
  Check,
  Link2,
  UserPlus,
} from "lucide-react";
import { ShareToMessageDialog } from "@/components/messages/ShareToMessageDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DailyIframe, {
  type DailyCall,
  type DailyEventObjectActiveSpeakerChange,
  type DailyEventObjectAppMessage,
  type DailyFactoryOptions,
  type DailyParticipant,
} from "@daily-co/daily-js";
import { destroyExistingDailyFrameAsync } from "@/lib/dailyFrame";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Clubhouse / Twitter-Spaces style Sound Stage room.
 * Audio-first. Stage (host + speakers) on top, audience grid below.
 * Audience can raise hand → host promotes to speaker.
 *
 * Fullscreen destination, not an overlay -- a fixed inset-0 layer above the
 * app chrome (there is no dedicated route; the join/create data flow through
 * LiveCallsPanel's own state was already correct per the Phase 1 audit, so
 * this stays a takeover layer rather than a route change, to avoid touching
 * that working data flow for a container-only ask).
 *
 * Primary actions (join/start, share, screen share, record) use the
 * STAGE_CTA_PRIMARY class + STAGE_CTA_GRADIENT_STYLE style -- a controlled
 * grey-to-pink gradient scoped to this component only, not a change to the
 * shared Button variants used project-wide. Destructive actions (leave, end)
 * stay on the existing outline/destructive Button variants so they never
 * read as the primary CTA.
 *
 * The gradient is applied via inline `style`, not a Tailwind bg-gradient-*
 * className: every non-link Button variant carries the global .btn-glass
 * class (index.css), which sets its own background outside Tailwind's
 * cascade layers -- unlayered CSS beats a plain utility class regardless of
 * source order (confirmed earlier this session fixing the Auth page's Apple
 * button, which broke the same way). Inline style is the one thing
 * guaranteed to win.
 */
const STAGE_CTA_PRIMARY =
  "text-white border border-white/10 shadow-lg hover:shadow-[0_0_28px_-6px_hsl(var(--energy)/0.55)] hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:hover:shadow-lg transition-all";
const STAGE_CTA_GRADIENT_STYLE = {
  background: "linear-gradient(135deg, hsl(240 14% 18%), hsl(var(--energy)))",
};

interface SoundStageRoomProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomUrl: string;
  token: string | null;
  title: string;
  mode: "audio" | "video";
  format?: "open_1to1" | "open_group" | "audience";
  isHost: boolean;
  stageId: string | null;
  hostUserId: string | null;
  userName: string;
  userAvatar?: string | null;
  /** Host-only soundcheck. Stage is hidden from the rail until host taps
   *  "Open the doors", which flips sound_stages.is_live = true. */
  backstage?: boolean;
}

type Role = "host" | "speaker" | "audience";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type StageMessage =
  | { type: "raise-hand"; raised: boolean }
  | { type: "promote"; userId: string }
  | { type: "demote"; userId: string };

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

interface Member {
  sessionId: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  audioOn: boolean;
  videoOn: boolean;
  videoState: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  role: Role;
  handRaised: boolean;
}

export function SoundStageRoom({
  open,
  onOpenChange,
  roomUrl,
  token,
  title,
  mode,
  format = "open_group",
  isHost,
  stageId,
  hostUserId,
  userName,
  userAvatar,
  backstage = false,
}: SoundStageRoomProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const callRef = useRef<DailyCall | null>(null);
  // Local backstage flag — flips to false when host taps "Open the doors".
  const [isBackstage, setIsBackstage] = useState(backstage);
  const [openingDoors, setOpeningDoors] = useState(false);
  const [joining, setJoining] = useState(false);
  const [phase, setPhase] = useState<"miccheck" | "joining" | "in">("miccheck");
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [myAudio, setMyAudio] = useState(true);
  const [myVideo, setMyVideo] = useState(mode === "video" && isHost);
  const [localLevel, setLocalLevel] = useState(0); // 0..1 live mic VU
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(
    null,
  );
  // Live captions (Phase 3C). Rolling window of recent finalized lines.
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionsStarting, setCaptionsStarting] = useState(false);
  const [captions, setCaptions] = useState<
    Array<{ id: string; speaker: string; text: string; ts: number }>
  >([]);
  // Screen share — local toggle + tick counter to re-render when remote
  // screen tracks update (Daily fires participant-updated which already
  // triggers refreshMembers, but screen tracks live outside `members`).
  const [sharingScreen, setSharingScreen] = useState(false);
  const [screenTick, setScreenTick] = useState(0);
  // Cloud recording (host-only). Daily emits recording-started/stopped events
  // to ALL participants so the indicator stays in sync.
  const [recording, setRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  // "unknown" until Daily's first network-quality-change event lands --
  // never shown to the user as a state, since we have no real reading yet.
  const [networkState, setNetworkState] = useState<"good" | "warning" | "bad" | "unknown">("unknown");
  // Recording start/stop is otherwise only visible (the REC badge) -- a
  // screen-reader user gets no signal that anything changed. Announce real
  // transitions only, never on initial mount (both start at false/false,
  // so the ref-vs-state comparison below is naturally silent then).
  const [recordingAnnouncement, setRecordingAnnouncement] = useState("");
  // Audience format rooms allow up to 200 people -- mounting an avatar tile
  // per person unconditionally means up to 200 DOM nodes (with their own
  // useMemo'd color calc each) rendered regardless of what's actually
  // visible. Capped by default with an explicit expand, not virtualized:
  // far simpler than pulling in a virtualization library for what's still
  // plain avatar tiles (no video/audio track mounts happen for audience
  // members either way -- see the render below), while still bounding
  // worst-case DOM size for the common case.
  const [showAllAudience, setShowAllAudience] = useState(false);
  const AUDIENCE_PREVIEW_COUNT = 24;
  const prevRecordingRef = useRef(false);
  useEffect(() => {
    if (prevRecordingRef.current !== recording) {
      setRecordingAnnouncement(recording ? "Recording started" : "Recording stopped");
      prevRecordingRef.current = recording;
    }
  }, [recording]);
  const localLevelRef = useRef(0);
  const profileCache = useRef<
    Map<string, { name: string; avatar: string | null }>
  >(new Map());
  const isHostRef = useRef(isHost);
  const stageIdRef = useRef(stageId);

  // Track who the host has promoted to speaker (host-local, broadcast via app-message)
  const speakersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isHostRef.current = isHost;
    stageIdRef.current = stageId;
  }, [isHost, stageId]);

  // Re-sync backstage when the host re-opens a freshly created stage.
  useEffect(() => {
    setIsBackstage(backstage);
  }, [backstage, stageId]);

  const openTheDoors = useCallback(async () => {
    if (!stageId || !isHost || openingDoors) return;
    setOpeningDoors(true);
    try {
      const { error } = await supabase
        .from("sound_stages")
        .update({ is_live: true, started_at: new Date().toISOString() })
        .eq("id", stageId);
      if (error) throw error;
      setIsBackstage(false);
      toast({ title: "Doors are open", description: "Your stage is now on the rail." });
    } catch (e: unknown) {
      toast({
        title: "Couldn't open the doors",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setOpeningDoors(false);
    }
  }, [stageId, isHost, openingDoors, toast]);

  const cleanupCall = useCallback((endStage: boolean) => {
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      void call.leave().catch(() => undefined);
      void call.destroy().catch(() => undefined);
    }
    if (endStage && isHostRef.current && stageIdRef.current) {
      supabase.functions
        .invoke("end-sound-stage", { body: { stage_id: stageIdRef.current } })
        .catch(() => undefined);
    }
  }, []);

  const localSessionId =
    callRef.current?.participants()?.local?.session_id ?? null;

  const refreshMembers = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const parts = call.participants();
    const next: Record<string, Member> = {};
    const userIdsToFetch: string[] = [];

    Object.values(parts).forEach((p: DailyParticipant) => {
      const uid = (p.user_id as string) || null;
      const cached = uid ? profileCache.current.get(uid) : null;
      if (uid && !cached) userIdsToFetch.push(uid);
      const audioState = p.tracks?.audio?.state;
      const videoState = p.tracks?.video?.state;
      const isOwner = !!p.owner;
      const isHostByUserId = !!(uid && hostUserId && uid === hostUserId);
      let role: Role = "audience";
      if (isOwner || isHostByUserId) role = "host";
      else if (uid && speakersRef.current.has(uid)) role = "speaker";

      next[p.session_id] = {
        sessionId: p.session_id,
        userId: uid,
        name: cached?.name || p.user_name || "Guest",
        avatar: cached?.avatar || null,
        audioOn: audioState
          ? audioState !== "off" && audioState !== "blocked"
          : !!p.audio,
        videoOn: videoState
          ? videoState !== "off" && videoState !== "blocked"
          : !!p.video,
        videoState: videoState ?? null,
        isLocal: !!p.local,
        isSpeaking: false,
        role,
        handRaised: false,
      };
    });

    setMembers((prev) => {
      // Preserve handRaised + isSpeaking flags across refreshes
      Object.keys(next).forEach((sid) => {
        if (prev[sid]) {
          next[sid].isSpeaking = prev[sid].isSpeaking;
          next[sid].handRaised = prev[sid].handRaised;
        }
      });
      return next;
    });

    if (userIdsToFetch.length > 0) {
      const { data } = await supabase
        .from("public_profiles_safe")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIdsToFetch);
      ((data || []) as ProfileRow[]).forEach((p) => {
        profileCache.current.set(p.user_id, {
          name: p.full_name || "Creator",
          avatar: p.avatar_url,
        });
      });
      // Re-apply names/avatars
      setMembers((prev) => {
        const copy = { ...prev };
        Object.values(copy).forEach((m) => {
          if (m.userId) {
            const c = profileCache.current.get(m.userId);
            if (c) {
              m.name = c.name;
              m.avatar = c.avatar;
            }
          }
        });
        return copy;
      });
    }
  }, [hostUserId]);

  // Reset to mic-check whenever the sheet opens
  useEffect(() => {
    if (open) {
      setPhase("miccheck");
      setJoining(false);
      setMembers({});
      setHandRaised(false);
      setMyAudio(true);
      setMyVideo(mode === "video" && isHost);
    }
  }, [open, mode, isHost]);

  // Local mic + camera preview — ONLY during mic-check. We must release the
  // devices before Daily joins, otherwise the camera/mic are locked by this
  // preview and Daily's setLocalVideo/Audio silently fails (the user lands
  // in what looks like an audio-only room even though they picked video).
  useEffect(() => {
    if (!open || phase !== "miccheck") {
      setLocalCamStream(null);
      setLocalLevel(0);
      localLevelRef.current = 0;
      return;
    }
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let raf = 0;
    let cancelled = false;
    (async () => {
      try {
        const wantVideo = mode === "video";
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantVideo
            ? {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
              }
            : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (wantVideo) setLocalCamStream(stream);
        const Ctx =
          window.AudioContext ||
          (window as WindowWithWebkitAudioContext).webkitAudioContext;
        if (!Ctx) throw new Error("AudioContext unavailable");
        audioCtx = new Ctx();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const level = Math.min(1, rms * 3);
          localLevelRef.current = level;
          setLocalLevel(level);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e: unknown) {
        console.error("[SoundStageRoom] media permission failed", e);
        toast({
          title:
            mode === "video" ? "Camera + mic needed" : "Mic permission needed",
          description: "Allow access in your browser, then try again.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      void audioCtx?.close().catch(() => undefined);
      stream?.getTracks().forEach((t) => t.stop());
      setLocalCamStream(null);
    };
  }, [open, phase, mode, toast]);

  // Initialize/cleanup the Daily call for this sheet session. Keep this effect
  // independent from `phase`: changing `phase` from joining → in must not run
  // cleanup, or the freshly joined room immediately leaves/destroys itself.
  useEffect(() => {
    if (!open) {
      cleanupCall(true);
      return;
    }
    return () => cleanupCall(false);
  }, [open, roomUrl, token, cleanupCall]);

  // Initialize Daily call (only after mic check passes)
  useEffect(() => {
    if (!open || !roomUrl || phase !== "joining" || callRef.current) return;
    let cancelled = false;
    let onAnyTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      setJoining(true);
      await destroyExistingDailyFrameAsync();
      // Give the mic-check preview a tick to fully release camera/mic on mobile
      await new Promise((r) => setTimeout(r, 250));
      if (cancelled) return;
      try {
        let call: DailyCall;
        const opts: DailyFactoryOptions = {
          url: roomUrl,
          token: token ?? undefined,
          audioSource: true,
          videoSource: mode === "video",
          startAudioOff: false,
          startVideoOff: mode !== "video" || !isHost,
          userName,
          subscribeToTracksAutomatically: true,
          // HD-preferred, not HD-forced: 'adaptive-3-layers' asks Daily to
          // simulcast low/medium/high encodings and let its own SFU pick the
          // layer each receiver's real network can sustain, degrading and
          // recovering automatically -- this is Daily's own adaptive-bitrate
          // mechanism, not a hand-rolled one. No video call above forces a
          // resolution; this is the real lever for "HD-preferred, adaptive
          // quality" against this provider. 'detail-optimized' screen video
          // favors legible slides/text over motion smoothness, the more
          // common case for a Stage's screen share.
          sendSettings: mode === "video"
            ? { video: "adaptive-3-layers", screenVideo: "detail-optimized" }
            : { screenVideo: "detail-optimized" },
        };
        try {
          call = DailyIframe.createCallObject(opts);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("Duplicate")) {
            await destroyExistingDailyFrameAsync();
            call = DailyIframe.createCallObject(opts);
          } else {
            throw err;
          }
        }
        callRef.current = call;

        // Daily fires participant-joined/updated/left and track-started/
        // stopped independently per track per participant -- a group join
        // or a burst of camera/mic startups can trigger this many times
        // within milliseconds. Coalescing into one refresh per short window
        // avoids a full members re-fetch (and the profile-cache lookups,
        // React state update, and tile re-render that follow) per event.
        // onAnyTimer lives in the effect's own scope (not a ref) so the
        // effect's cleanup below can clear it directly.
        const onAny = () => {
          if (onAnyTimer) clearTimeout(onAnyTimer);
          onAnyTimer = setTimeout(() => {
            onAnyTimer = null;
            refreshMembers().catch(() => {});
            setScreenTick((t) => t + 1);
          }, 150);
        };
        call.on("participant-joined", onAny);
        call.on("participant-updated", onAny);
        call.on("participant-left", onAny);
        call.on("joined-meeting", onAny);
        call.on("track-started", onAny);
        call.on("track-stopped", onAny);
        // Screen share events — flip local state so the button reflects truth.
        call.on("local-screen-share-started", () => setSharingScreen(true));
        call.on("local-screen-share-stopped", () => setSharingScreen(false));
        // Cloud recording state sync (host triggers, all participants see).
        call.on("recording-started" as any, () => {
          setRecording(true);
          setRecordingBusy(false);
        });
        call.on("recording-stopped" as any, () => {
          setRecording(false);
          setRecordingBusy(false);
        });
        call.on("recording-error" as any, (ev: any) => {
          setRecording(false);
          setRecordingBusy(false);
          toast({
            title: "Recording unavailable",
            description: ev?.errorMsg || "Daily cloud recording isn't enabled on this workspace.",
            variant: "destructive",
          });
        });

        // Real network-quality signal from Daily's own SFU-side measurement
        // (packet loss / bitrate), not a client-side guess. 'unknown' (the
        // initial state) is never rendered -- see the networkState UI below.
        call.on("network-quality-change", (ev) => {
          setNetworkState(ev.networkState);
        });

        call.on(
          "active-speaker-change",
          (ev: DailyEventObjectActiveSpeakerChange) => {
            const sid = ev?.activeSpeaker?.peerId ?? null;
            setActiveSpeakerId(sid);
            setMembers((prev) => {
              const copy = { ...prev };
              Object.values(copy).forEach((m) => {
                m.isSpeaking = m.sessionId === sid;
              });
              return copy;
            });
          },
        );

        call.on(
          "app-message",
          (ev: DailyEventObjectAppMessage<StageMessage>) => {
            const msg = ev?.data;
            if (!msg?.type) return;
            if (msg.type === "raise-hand") {
              setMembers((prev) => {
                const sid = ev.fromId;
                if (!prev[sid]) return prev;
                return {
                  ...prev,
                  [sid]: { ...prev[sid], handRaised: !!msg.raised },
                };
              });
            }
            if (msg.type === "promote") {
              if (msg.userId) speakersRef.current.add(msg.userId);
              refreshMembers().catch(() => {});
            }
            if (msg.type === "demote") {
              if (msg.userId) speakersRef.current.delete(msg.userId);
              refreshMembers().catch(() => {});
            }
          },
        );

        // ─── Phase 3C: live captions via Daily transcription ───
        // Fires for both interim and final transcript chunks.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("transcription-message" as any, (ev: any) => {
          if (!ev?.text || typeof ev.text !== "string") return;
          // Daily sends interim updates while a speaker talks; only keep finals.
          if (ev.is_final === false) return;
          const speaker =
            ev.user_name ||
            (ev.session_id &&
              callRef.current?.participants()?.[ev.session_id]?.user_name) ||
            "Speaker";
          const line = {
            id: `${ev.session_id ?? "x"}-${Date.now()}-${Math.random()}`,
            speaker,
            text: String(ev.text).trim(),
            ts: Date.now(),
          };
          setCaptions((prev) => [...prev.slice(-5), line]);
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("transcription-started" as any, () => setCaptionsOn(true));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("transcription-stopped" as any, () => setCaptionsOn(false));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        call.on("transcription-error" as any, (ev: any) => {
          console.warn("[SoundStageRoom] transcription error", ev);
          setCaptionsOn(false);
          setCaptionsStarting(false);
          toast({
            title: "Captions unavailable",
            description:
              "Live captions aren't enabled for this room. The recap will still be transcribed after the stage ends.",
            variant: "destructive",
          });
        });

        await call.join({
          url: roomUrl,
          token: token ?? undefined,
          userName,
          startAudioOff: false,
          startVideoOff: mode !== "video" || !isHost,
        });
        if (cancelled) return;

        // Host starts with mic on, audience starts muted. Daily already starts
        // camera/mic from createCallObject()/join() options; after join(), the
        // supported API is setLocalVideo()/setLocalAudio() — startCamera()
        // throws once the meeting is joined.
        if (!isHost) {
          await call.setLocalAudio(false);
          await call.setLocalVideo(false);
          setMyAudio(false);
          setMyVideo(false);
        } else {
          await call.setLocalAudio(true);
          setMyAudio(true);
          if (mode === "video") {
            try {
              await call.setLocalVideo(true);
              setMyVideo(true);
            } catch (videoError: unknown) {
              console.error("[SoundStageRoom] camera start failed", videoError);
              setMyVideo(false);
              const message =
                videoError instanceof Error ? videoError.message : null;
              toast({
                title: "Camera didn't start",
                description:
                  message ||
                  "Your mic is live, but the camera was blocked or already in use.",
                variant: "destructive",
              });
            }
          }
        }
        setJoining(false);
        setPhase("in");
        refreshMembers().catch(() => {});
      } catch (e: unknown) {
        console.error("[SoundStageRoom] join failed", e);
        toast({
          title: "Couldn't enter the stage",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
        onOpenChange(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (onAnyTimer) clearTimeout(onAnyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roomUrl, token, phase]);

  const toggleMic = async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !myAudio;
    try {
      await call.setLocalAudio(next);
      setMyAudio(next);
    } catch (e: unknown) {
      console.error("[SoundStageRoom] toggle mic failed", e);
      toast({
        title: "Mic unavailable",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const toggleCam = async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !myVideo;
    try {
      await call.setLocalVideo(next);
      setMyVideo(next);
    } catch (e: unknown) {
      console.error("[SoundStageRoom] toggle camera failed", e);
      setMyVideo(false);
      const message = e instanceof Error ? e.message : null;
      toast({
        title: "Camera unavailable",
        description:
          message || "Check camera permission or close another app using it.",
        variant: "destructive",
      });
    }
  };
  const toggleScreenShare = async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      if (sharingScreen) {
        await call.stopScreenShare();
        setSharingScreen(false);
      } else {
        await call.startScreenShare();
        // event handler will flip sharingScreen to true on success
      }
    } catch (e: unknown) {
      console.error("[SoundStageRoom] screen share failed", e);
      toast({
        title: "Couldn't share screen",
        description:
          e instanceof Error
            ? e.message
            : "Your browser may have blocked it, or no display was picked.",
        variant: "destructive",
      });
    }
  };


  // Phase 3C — host toggles live captions on/off. Daily routes audio through
  // its transcription provider; success fires "transcription-started" which
  // flips captionsOn to true. Failures surface via "transcription-error".
  const toggleCaptions = async () => {
    const call = callRef.current;
    if (!call || !isHost) return;
    setCaptionsStarting(true);
    try {
      // Derive Daily room_name from the room URL (last path segment).
      let roomName = "";
      try {
        roomName = new URL(roomUrl).pathname.replace(/^\//, "");
      } catch {
        roomName = "";
      }
      if (!roomName) throw new Error("Missing room name");

      const action = captionsOn ? "stop" : "start";
      const { data, error } = await supabase.functions.invoke(
        "start-stage-transcription",
        { body: { room_name: roomName, action, stage_id: stageIdRef.current } },
      );
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String((data as { error: string }).error));
      }
      if (action === "stop") setCaptions([]);
      // transcription-started / transcription-stopped events will flip
      // captionsOn for all participants (host + audience) shortly after.
    } catch (e: unknown) {
      console.error("[SoundStageRoom] toggle captions failed", e);
      toast({
        title: "Captions unavailable",
        description:
          e instanceof Error ? e.message : "Try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setCaptionsStarting(false);
    }
  };


  const toggleHand = async () => {
    const call = callRef.current;
    if (!call) return;
    const next = !handRaised;
    setHandRaised(next);
    call.sendAppMessage({ type: "raise-hand", raised: next }, "*");
  };

  const promote = async (m: Member) => {
    if (!isHost || !m.userId) return;
    speakersRef.current.add(m.userId);
    callRef.current?.sendAppMessage({ type: "promote", userId: m.userId }, "*");
    refreshMembers();
    toast({ title: `${m.name} is now on stage` });
  };

  const demote = async (m: Member) => {
    if (!isHost || !m.userId) return;
    speakersRef.current.delete(m.userId);
    callRef.current?.sendAppMessage({ type: "demote", userId: m.userId }, "*");
    // Also force-mute them
    callRef.current?.updateParticipant(m.sessionId, { setAudio: false });
    refreshMembers();
  };

  const muteParticipant = async (m: Member) => {
    if (!isHost) return;
    callRef.current?.updateParticipant(m.sessionId, { setAudio: false });
  };

  const removeParticipant = async (m: Member) => {
    if (!isHost) return;
    callRef.current?.updateParticipant(m.sessionId, { eject: true });
  };

  // Recording/replay integration: SoundStageRoom already starts/stops Daily's
  // cloud recording (below) and Recordings.tsx already lists + replays
  // sound_stage recordings via the existing RecordingReplayDialog (built in
  // a prior sprint) -- the missing link was purely that nothing here ever
  // told the host where the recording goes. Daily's webhook resolves a
  // "ss-" room to a call_transcripts row asynchronously (not ready the
  // instant the call ends), so this can't open the replay directly -- it
  // points at the surface that already handles "not ready yet" correctly,
  // rather than polling or guessing readiness here. Host-only: the same
  // known, pre-existing call_transcripts authorization only actually grants
  // created_by (the host) access for this call_kind today (see
  // docs/SECURITY_FINDINGS.md) -- showing this to non-hosts would promise
  // access they may not get.
  const leave = () => {
    if (recording && isHost) {
      toast({
        title: "Recording saved",
        description: "It'll appear in your Recordings once Daily finishes processing — usually a few minutes after a stage ends.",
        action: (
          <ToastAction altText="View Recordings" onClick={() => navigate("/recordings")}>
            View Recordings
          </ToastAction>
        ),
      });
    }
    onOpenChange(false);
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const stageShareUrl = stageId
    ? `${window.location.origin}/circle?tab=stages&join=${stageId}`
    : null;

  const copyShareLink = async () => {
    if (!stageShareUrl) return;
    try {
      await navigator.clipboard.writeText(stageShareUrl);
      setShareCopied(true);
      toast({ title: "Link copied" });
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!stageShareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Join "${title}" on Kretopia`, url: stageShareUrl });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
    } else {
      await copyShareLink();
    }
  };

  const toggleRecording = async () => {
    const call = callRef.current;
    if (!call || !isHost) return;
    setRecordingBusy(true);
    try {
      if (recording) {
        await (call as any).stopRecording?.();
      } else {
        await (call as any).startRecording?.({ layout: { preset: "default" } });
        toast({
          title: "Recording started",
          description: "Everyone in the room is notified. Recording uploads to your Daily workspace after the stage ends.",
        });
      }
    } catch (e: any) {
      setRecordingBusy(false);
      toast({
        title: "Couldn't toggle recording",
        description: e?.message || "Cloud recording may not be enabled on this workspace.",
        variant: "destructive",
      });
    }
  };


  const list = Object.values(members);
  // Remote participants whose audio track we need to play (call-object mode
  // does NOT auto-play remote audio — we must attach <audio> elements).
  const remoteAudioTracks = (() => {
    const call = callRef.current;
    if (!call) return [] as { sessionId: string; track: MediaStreamTrack }[];
    const parts = call.participants();
    const out: { sessionId: string; track: MediaStreamTrack }[] = [];
    Object.values(parts).forEach((p: DailyParticipant) => {
      if (p.local) return;
      const track = p.tracks?.audio?.persistentTrack || p.tracks?.audio?.track;
      if (track) out.push({ sessionId: p.session_id, track });
    });
    return out;
  })();

  // Map session_id → video MediaStreamTrack (local + remote) for video stages.
  const videoTracksBySession = (() => {
    const call = callRef.current;
    const map: Record<string, MediaStreamTrack> = {};
    if (!call || mode !== "video") return map;
    const parts = call.participants();
    Object.values(parts).forEach((p: DailyParticipant) => {
      const track = p.tracks?.video?.persistentTrack || p.tracks?.video?.track;
      if (track) map[p.session_id] = track;
    });
    return map;
  })();

  // Active screen share — works for both audio and video stages. We pick the
  // most recent screen track and render it as a hero tile above the stage.
  // Referencing screenTick keeps this fresh when Daily fires participant-updated.
  void screenTick;
  const activeScreenShare: { name: string; track: MediaStreamTrack; isLocal: boolean } | null = (() => {
    const call = callRef.current;
    if (!call) return null;
    const parts = call.participants();
    for (const p of Object.values(parts) as DailyParticipant[]) {
      const t =
        p.tracks?.screenVideo?.persistentTrack || p.tracks?.screenVideo?.track;
      const state = p.tracks?.screenVideo?.state;
      if (t && state && state !== "off" && state !== "blocked") {
        return {
          name: (p.user_name as string) || "Speaker",
          track: t,
          isLocal: !!p.local,
        };
      }
    }
    return null;
  })();

  const stage = list.filter((m) => m.role === "host" || m.role === "speaker");
  const audience = list.filter((m) => m.role === "audience");
  const raisedHands = audience.filter((m) => m.handRaised);
  const totalCount = list.length;

  const meSpeaker = useMemo(() => {
    const me = list.find((m) => m.isLocal);
    return !!me && (me.role === "host" || me.role === "speaker");
  }, [list]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Real Radix Dialog primitives, not a bare div -- the Sheet this
            replaced gave focus-trap and Escape-to-close for free, and a
            plain fixed div silently drops both (confirmed while auditing
            this rewrite for accessibility: a bare div has no role, no
            focus trap, and Escape does nothing). Content itself carries
            the fullscreen styling instead of shadcn's centered/max-w
            DialogContent, and Escape closes it the same way the header's
            X does -- restoring the Sheet's own prior behavior, not new.
            Accessible name comes from the real DialogPrimitive.Title
            below (wrapping the visible stage-title h1 via asChild, not a
            second hidden element) -- an aria-label here was tried first
            but Radix's own dev-mode warning ("DialogContent requires a
            DialogTitle") confirmed aria-label alone doesn't satisfy its
            internal check, caught live via console during this pass's
            browser verification, not assumed. */}
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200 focus:outline-none"
          aria-describedby={undefined}
        >
        <span aria-live="polite" className="sr-only">{recordingAnnouncement}</span>
        {/* Top bar */}
        <div
          className="px-3 sm:px-4 pt-3 pb-2.5 border-b border-border/60 shrink-0 space-y-2"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
        >
          <div className="flex items-center gap-2.5">
            {isBackstage ? (
              <Badge
                className="gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-[hsl(var(--signal-amber))] text-[#05070D] hover:bg-[hsl(var(--signal-amber))] shrink-0"
              >
                <Radio className="h-2.5 w-2.5" /> Backstage
              </Badge>
            ) : (
              <Badge
                variant="destructive"
                className="gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shrink-0"
              >
                <Radio className="h-2.5 w-2.5 animate-pulse" /> Live
              </Badge>
            )}
            {recording && (
              <Badge
                variant="destructive"
                className="gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide animate-pulse shrink-0"
                title="This stage is being recorded"
              >
                <Circle className="h-2.5 w-2.5 fill-current" /> Rec
              </Badge>
            )}
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title asChild>
                <h1 className="font-bold text-sm leading-tight truncate">{title}</h1>
              </DialogPrimitive.Title>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {isBackstage ? "Doors closed — only you" : `${totalCount} in the room`}
                </span>
                {/* Real network-quality reading from Daily's own SFU-side
                    measurement -- never shown before the first real event,
                    and the word (Excellent/Good/Limited) always carries the
                    state, not the dot color alone. */}
                {phase === "in" && networkState !== "unknown" && (
                  <span className="flex items-center gap-1">
                    <span aria-hidden>·</span>
                    <span
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        networkState === "good" && "bg-[hsl(var(--signal-teal))]",
                        networkState === "warning" && "bg-[hsl(var(--signal-amber))]",
                        networkState === "bad" && "bg-destructive",
                      )}
                    />
                    <span className={cn(networkState === "bad" && "text-destructive font-medium")}>
                      {networkState === "good" ? "Excellent" : networkState === "warning" ? "Good" : "Limited"}
                    </span>
                  </span>
                )}
              </p>
            </div>

            {!isBackstage && phase === "in" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                onClick={() => setShareOpen(true)}
                aria-label="Share this Stage"
                title="Share this Stage"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0"
              onClick={leave}
              aria-label="Leave Stage"
              title="Leave"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {isBackstage && isHost && phase === "miccheck" && (
            <div className="rounded-xl bg-[hsl(var(--signal-amber))]/10 border border-[hsl(var(--signal-amber))]/40 px-3 py-2">
              <p className="text-[11px] font-semibold leading-tight">Soundcheck mode</p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Check your camera + mic. Doors open the moment you tap Go live.
              </p>
            </div>
          )}
          {isBackstage && isHost && phase !== "miccheck" && (
            <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--signal-amber))]/10 border border-[hsl(var(--signal-amber))]/40 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold leading-tight">Doors still closed</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Rehearse as long as you like — tap when you're ready for the rail.
                </p>
              </div>
              <Button
                size="sm"
                className={cn("rounded-full h-8 text-[11px] font-bold shrink-0", STAGE_CTA_PRIMARY)}
                style={STAGE_CTA_GRADIENT_STYLE}
                onClick={openTheDoors}
                disabled={openingDoors}
              >
                {openingDoors ? "Opening…" : "Open the doors"}
              </Button>
            </div>
          )}
        </div>

        {/* Body — centered column even at full-screen width so text/roster
            content doesn't stretch edge-to-edge on wide desktop viewports;
            video/audience grids inside still use the full column width. */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="max-w-3xl mx-auto space-y-7">
          {phase === "miccheck" ? (
            <MicCheckScreen
              level={localLevel}
              userName={userName}
              userAvatar={userAvatar}
              isHost={isHost}
              mode={mode}
              camStream={localCamStream}
              onJoin={() => {
                if (isBackstage && isHost) void openTheDoors();
                setPhase("joining");
              }}
              onCancel={leave}
              backstage={isBackstage && isHost}
            />
          ) : joining ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Walking on stage…</p>
            </div>
          ) : (
            <>
              {/* Active screen share — hero tile above the stage */}
              {activeScreenShare && (
                <section className="space-y-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[hsl(var(--signal-teal))] flex items-center gap-1.5">
                    <ScreenShare className="h-3 w-3" />
                    {activeScreenShare.isLocal
                      ? "You're sharing your screen"
                      : `${activeScreenShare.name.split(" ")[0]} is sharing`}
                  </h3>
                  <div className="rounded-2xl overflow-hidden bg-black border-2 border-[hsl(var(--signal-teal))] aspect-video">
                    <VideoTrackView track={activeScreenShare.track} muted />
                  </div>
                </section>
              )}

              {/* On stage — layout adapts to (mode × format) */}
              <section className="space-y-3">

                <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                  {format === "audience"
                    ? "On stage"
                    : format === "open_1to1"
                      ? "In the call"
                      : "On stage"}{" "}
                  · {stage.length}
                </h3>

                {stage.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No one on stage yet.
                  </p>
                ) : mode === "video" ? (
                  // ===== VIDEO LAYOUTS =====
                  format === "audience" ? (
                    // Performance: ONE giant hero performer + tiny strip of co-hosts (if any)
                    <div className="space-y-2">
                      <VideoStageTile
                        member={stage[0]}
                        isHostView={isHost}
                        onDemote={demote}
                        onMute={muteParticipant}
                        onRemove={removeParticipant}
                        localLevel={stage[0].isLocal ? localLevel : undefined}
                        videoTrack={videoTracksBySession[stage[0].sessionId]}
                        hero
                      />
                      {stage.length > 1 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {stage.slice(1).map((m) => (
                            <VideoStageTile
                              key={m.sessionId}
                              member={m}
                              isHostView={isHost}
                              onDemote={demote}
                              onMute={muteParticipant}
                              onRemove={removeParticipant}
                              localLevel={m.isLocal ? localLevel : undefined}
                              videoTrack={videoTracksBySession[m.sessionId]}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : format === "open_1to1" ? (
                    // 1:1 face-to-face — stack vertical on mobile, split desktop
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stage.map((m) => (
                        <VideoStageTile
                          key={m.sessionId}
                          member={m}
                          isHostView={isHost}
                          onDemote={demote}
                          onMute={muteParticipant}
                          onRemove={removeParticipant}
                          localLevel={m.isLocal ? localLevel : undefined}
                          videoTrack={videoTracksBySession[m.sessionId]}
                          tall
                        />
                      ))}
                    </div>
                  ) : (
                    // Group video — balanced grid, hero only when solo
                    <div
                      className={cn(
                        "grid gap-2",
                        stage.length === 1 && "grid-cols-1",
                        stage.length === 2 && "grid-cols-1 sm:grid-cols-2",
                        stage.length === 3 && "grid-cols-2 sm:grid-cols-3",
                        stage.length === 4 && "grid-cols-2",
                        stage.length >= 5 && "grid-cols-2 sm:grid-cols-3",
                      )}
                    >
                      {stage.map((m) => (
                        <VideoStageTile
                          key={m.sessionId}
                          member={m}
                          isHostView={isHost}
                          onDemote={demote}
                          onMute={muteParticipant}
                          onRemove={removeParticipant}
                          localLevel={m.isLocal ? localLevel : undefined}
                          videoTrack={videoTracksBySession[m.sessionId]}
                          hero={stage.length === 1}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  // ===== AUDIO LAYOUTS =====
                  <div
                    className={cn(
                      "grid gap-x-2 gap-y-5",
                      format === "open_1to1"
                        ? "grid-cols-2 max-w-xs mx-auto"
                        : "grid-cols-3 sm:grid-cols-4",
                    )}
                  >
                    {stage.map((m) => (
                      <StageTile
                        key={m.sessionId}
                        member={m}
                        large
                        xlarge={format === "open_1to1"}
                        isHostView={isHost}
                        onDemote={demote}
                        onMute={muteParticipant}
                        onRemove={removeParticipant}
                        localLevel={m.isLocal ? localLevel : undefined}
                        mode={mode}
                        videoTrack={videoTracksBySession[m.sessionId]}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Raised hands — host control */}
              {isHost && raisedHands.length > 0 && (
                <section className="space-y-2 rounded-xl border border-energy/40 bg-energy/5 p-3">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-energy flex items-center gap-1.5">
                    <Hand className="h-3 w-3" /> Wants to speak ·{" "}
                    {raisedHands.length}
                  </h3>
                  <div className="space-y-2">
                    {raisedHands.map((m) => (
                      <div
                        key={m.sessionId}
                        className="flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.avatar ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {m.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <p className="flex-1 text-sm font-semibold truncate">
                          {m.name}
                        </p>
                        <Button
                          size="sm"
                          variant="lime"
                          className="rounded-full h-7 text-xs"
                          onClick={() => promote(m)}
                        >
                          Bring up
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* In the audience — hidden for 1:1 calls */}
              {format !== "open_1to1" && (
                <section className="space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                    {format === "audience" ? "Listening in" : "In the audience"}{" "}
                    · {audience.length}
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-4">
                    {(showAllAudience ? audience : audience.slice(0, AUDIENCE_PREVIEW_COUNT)).map((m) => (
                      <StageTile
                        key={m.sessionId}
                        member={m}
                        localLevel={m.isLocal ? localLevel : undefined}
                      />
                    ))}
                    {audience.length === 0 && (
                      <p className="col-span-full text-xs text-muted-foreground">
                        {format === "audience"
                          ? "No one tuned in yet."
                          : "Quiet so far."}
                      </p>
                    )}
                  </div>
                  {!showAllAudience && audience.length > AUDIENCE_PREVIEW_COUNT && (
                    <button
                      type="button"
                      onClick={() => setShowAllAudience(true)}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      +{audience.length - AUDIENCE_PREVIEW_COUNT} more
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          </div>
        </div>

        {/* Phase 3C — Live captions overlay (rolling 3 lines) */}
        {captionsOn && captions.length > 0 && (
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-[140px] z-30 px-4"
            aria-live="polite"
          >
            <div className="mx-auto max-w-2xl rounded-2xl bg-background/95 border border-border/70 px-3 py-2 shadow-lg space-y-0.5">
              {captions.slice(-3).map((c) => (
                <p key={c.id} className="text-sm leading-snug text-foreground">
                  <span className="text-muted-foreground font-medium mr-1.5">
                    {c.speaker}:
                  </span>
                  {c.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Bottom control bar */}
        <div
          className="border-t border-border/60 px-4 pt-3 bg-background shrink-0"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="rounded-full text-xs h-10 px-4 gap-1.5"
              onClick={leave}
            >
              <X className="h-3.5 w-3.5" /> Leave
            </Button>
            {isHost && (
              <Button
                variant={captionsOn ? "lime" : "outline"}
                size="sm"
                className="rounded-full text-xs h-10 px-3 gap-1.5"
                onClick={toggleCaptions}
                disabled={captionsStarting}
                aria-label={captionsOn ? "Stop live captions" : "Start live captions"}
                title={captionsOn ? "Live captions on — tap to stop" : "Turn on live captions"}
              >
                {captionsStarting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : captionsOn ? (
                  <Captions className="h-3.5 w-3.5" />
                ) : (
                  <CaptionsOff className="h-3.5 w-3.5" />
                )}
                <span>{captionsOn ? "Captions on" : "Captions"}</span>
              </Button>
            )}
            {isHost && (
              <Button
                variant={recording ? "destructive" : "outline"}
                size="sm"
                className={cn("rounded-full text-xs h-10 px-3 gap-1.5", !recording && STAGE_CTA_PRIMARY)}
                style={!recording ? STAGE_CTA_GRADIENT_STYLE : undefined}
                onClick={toggleRecording}
                disabled={recordingBusy}
                aria-label={recording ? "Stop recording" : "Start recording"}
                title={recording ? "Recording — tap to stop" : "Record this stage"}
              >
                {recordingBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : recording ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Circle className="h-3.5 w-3.5 fill-current" />
                )}
                <span>{recording ? "Recording" : "Record"}</span>
              </Button>
            )}
            <div className="flex items-center gap-2">
              {meSpeaker ? (
                <>
                  {/* Invite — host/speakers only, matching the brief's
                      "authorized roles" requirement; audience members can
                      still use Share (top bar) since the stage is already
                      open to anyone. */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-11 w-11"
                    onClick={() => setInviteOpen(true)}
                    aria-label="Invite someone to this Stage"
                    title="Invite"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  {/* Screen share — desktop only (mobile browsers can't capture displays) */}
                  <Button
                    variant={sharingScreen ? "lime" : "outline"}
                    size="icon"
                    className={cn("rounded-full h-11 w-11 hidden sm:inline-flex", !sharingScreen && STAGE_CTA_PRIMARY)}
                    style={!sharingScreen ? STAGE_CTA_GRADIENT_STYLE : undefined}
                    onClick={toggleScreenShare}
                    aria-label={sharingScreen ? "Stop sharing screen" : "Share screen"}
                    title={sharingScreen ? "Stop sharing" : "Share your screen / slides"}
                  >
                    {sharingScreen ? (
                      <ScreenShareOff className="h-4 w-4" />
                    ) : (
                      <ScreenShare className="h-4 w-4" />
                    )}
                  </Button>
                  {mode === "video" && (
                    <Button
                      variant={myVideo ? "lime" : "outline"}
                      size="icon"
                      className="rounded-full h-11 w-11"
                      onClick={toggleCam}
                    >
                      {myVideo ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <VideoOff className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant={myAudio ? "lime" : "outline"}
                    size="icon"
                    className={cn(
                      "rounded-full h-12 w-12",
                      !myAudio && "border-destructive text-destructive",
                    )}
                    onClick={toggleMic}
                    aria-label={myAudio ? "Mute" : "Unmute"}
                  >
                    {myAudio ? (
                      <Mic className="h-5 w-5" />
                    ) : (
                      <MicOff className="h-5 w-5" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant={handRaised ? "lime" : "outline"}
                  className="rounded-full h-11 px-4 gap-1.5 text-xs"
                  onClick={toggleHand}
                >
                  <Hand
                    className={cn("h-4 w-4", handRaised && "animate-wave")}
                  />
                  {handRaised ? "Hand raised" : "Raise hand"}
                </Button>
              )}
            </div>
          </div>
          {!meSpeaker && (
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              You're listening. Raise your hand to ask to speak.
            </p>
          )}
        </div>

        {/* Hidden audio sinks for every remote participant (call-object mode
            requires manual track attachment — without this, no one is heard). */}
        <div aria-hidden className="sr-only">
          {remoteAudioTracks.map((t) => (
            <RemoteAudio key={t.sessionId} track={t.track} />
          ))}
        </div>

        {/* Share this Stage — copy link + native share only. No attendee
            list, no room token, no recording link exposed here; the shared
            link only carries the stage id, which join-sound-stage
            re-validates (is_live, capacity) server-side same as any other
            join path. */}
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Share this Stage</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Anyone with this link can walk on to <span className="font-medium text-foreground">{title}</span> while it's live.
              </p>
              {stageShareUrl && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-[11px] text-foreground/80 break-all">
                  {stageShareUrl}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5" onClick={copyShareLink}>
                  {shareCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {shareCopied ? "Copied" : "Copy link"}
                </Button>
                <Button className={cn("gap-1.5", STAGE_CTA_PRIMARY)} style={STAGE_CTA_GRADIENT_STYLE} onClick={nativeShare}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invite — distinct from Share above: resolves a real recipient
            from the caller's own connections (never a guessed/typed
            identity), sends one in-app message per person via the existing
            messages table (no new backend needed -- shared_content_type is
            a plain text column, no CHECK constraint to widen), no auto-send
            without the explicit "Send" tap in the dialog itself. Reuses the
            same connections-picker already used for sharing gigs/projects/
            events elsewhere in the app, not a second one built for Stage. */}
        {stageId && (
          <ShareToMessageDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            contentType="stage"
            contentId={stageId}
            contentMeta={{ title, subtitle: "Live now on Kretopia" }}
            externalUrl={stageShareUrl ?? undefined}
            externalText={`Join "${title}" live on Kretopia`}
          />
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function RemoteAudio({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    el.autoplay = true;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [track]);
  return <audio ref={ref} autoPlay playsInline />;
}

function ColorfulAvatar({
  className,
  name,
  avatar,
  seed,
}: {
  className?: string;
  name: string;
  avatar: string | null;
  seed: string | null;
}) {
  // Deterministic per-user lightness within the single accent hue, not a
  // full hue-wheel gradient -- keeps each fallback avatar distinguishable
  // without introducing off-brand colors.
  const lightness = useMemo(() => {
    const s = (seed || name || "x")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    return 30 + (s % 22);
  }, [seed, name]);
  const initial = (name?.trim()?.[0] || "?").toUpperCase();
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center",
        className,
      )}
      style={{
        background: `hsl(327 70% ${lightness}%)`,
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className="font-black text-white text-xl drop-shadow">
          {initial}
        </span>
      )}
    </div>
  );
}

function StageTile({
  member,
  large,
  xlarge,
  isHostView,
  onDemote,
  onMute,
  onRemove,
  localLevel,
  mode,
  videoTrack,
}: {
  member: Member;
  large?: boolean;
  xlarge?: boolean;
  isHostView?: boolean;
  onDemote?: (m: Member) => void;
  onMute?: (m: Member) => void;
  onRemove?: (m: Member) => void;
  localLevel?: number;
  mode?: "audio" | "video";
  videoTrack?: MediaStreamTrack;
}) {
  const size = xlarge
    ? "h-24 w-24 sm:h-28 sm:w-28"
    : large
      ? "h-16 w-16 sm:h-20 sm:w-20"
      : "h-12 w-12 sm:h-14 sm:w-14";
  const showHostMenu = isHostView && !member.isLocal;
  const liveSpeaking =
    member.isLocal && member.audioOn && (localLevel ?? 0) > 0.06;
  const speaking = member.isSpeaking || liveSpeaking;
  const showVideo = mode === "video" && member.videoOn && !!videoTrack;
  // Accessible text for the same state the badges above show visually
  // (role color, speaking glow, mute icon, hand emoji) -- never color/icon
  // alone, per the brief's own accessibility requirement.
  const statusText = [
    member.role === "host" && "host",
    speaking && "speaking",
    !speaking && !member.audioOn && member.role !== "audience" && "muted",
    member.handRaised && "hand raised",
  ].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col items-center gap-1.5 text-center min-w-0">
      <div className="relative">
        <div
          className={cn(
            "rounded-full p-[2px] transition-all",
            speaking
              ? "bg-[hsl(var(--signal-teal))] shadow-[0_0_0_4px_hsl(var(--signal-teal)/0.25)]"
              : "bg-transparent",
          )}
          style={
            liveSpeaking
              ? {
                  boxShadow: `0 0 0 ${4 + Math.round((localLevel ?? 0) * 10)}px hsl(var(--signal-teal) / 0.25)`,
                }
              : undefined
          }
        >
          {showVideo ? (
            <div
              className={cn(
                size,
                "rounded-full ring-2 ring-background overflow-hidden bg-black",
              )}
            >
              <VideoTrackView
                track={videoTrack!}
                muted={member.isLocal}
                mirror={member.isLocal}
              />
            </div>
          ) : (
            <ColorfulAvatar
              className={cn(size, "ring-2 ring-background")}
              name={member.name}
              avatar={member.avatar}
              seed={member.userId || member.sessionId}
            />
          )}
        </div>
        {/* Role / status badges -- decorative; the real, accessible status
            text is the sr-only span below the name, not these icons/emoji
            alone (active-speaker glow above is the same: color/shadow only,
            backed by the same text). */}
        {member.role === "host" && (
          <span aria-hidden="true" className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
            <Crown className="h-3 w-3" />
          </span>
        )}
        {member.handRaised && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-energy text-energy-foreground flex items-center justify-center text-[10px]">
            ✋
          </span>
        )}
        {!member.audioOn && member.role !== "audience" && (
          <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center ring-2 ring-background">
            <MicOff className="h-3 w-3" />
          </span>
        )}
        {showHostMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {member.role !== "audience" && (
                <>
                  <DropdownMenuItem onClick={() => onMute?.(member)}>
                    <MicOff className="h-3.5 w-3.5 mr-2" /> Mute
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDemote?.(member)}>
                    <Hand className="h-3.5 w-3.5 mr-2" /> Move to audience
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemove?.(member)}
              >
                <X className="h-3.5 w-3.5 mr-2" /> Remove from room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p
        className={cn(
          "font-semibold truncate w-full px-1",
          large ? "text-xs" : "text-[10px]",
        )}
      >
        {member.isLocal ? "You" : member.name.split(" ")[0]}
        {statusText && <span className="sr-only">, {statusText}</span>}
      </p>
      {member.role === "host" && large && (
        <span aria-hidden="true" className="text-[9px] text-amber-600 font-bold uppercase tracking-wide">
          Host
        </span>
      )}
    </div>
  );
}

function VideoStageTile({
  member,
  isHostView,
  onDemote,
  onMute,
  onRemove,
  localLevel,
  videoTrack,
  hero,
  tall,
}: {
  member: Member;
  isHostView?: boolean;
  onDemote?: (m: Member) => void;
  onMute?: (m: Member) => void;
  onRemove?: (m: Member) => void;
  localLevel?: number;
  videoTrack?: MediaStreamTrack;
  hero?: boolean;
  tall?: boolean;
}) {
  const showHostMenu = isHostView && !member.isLocal;
  const liveSpeaking =
    member.isLocal && member.audioOn && (localLevel ?? 0) > 0.06;
  const speaking = member.isSpeaking || liveSpeaking;
  const showVideo = member.videoOn && !!videoTrack;
  // Same rule as StageTile: the speaking glow (border/shadow) and the mute
  // icon below are never the only signal -- text carries the state too.
  const statusText = [
    member.role === "host" && "host",
    speaking && "speaking",
    !speaking && !member.audioOn && "muted",
  ].filter(Boolean).join(", ");
  // Deterministic per-user background so cam-off tiles never look "broken/
  // black" -- varies lightness within the single accent hue rather than a
  // full hue-wheel gradient, so it stays on-brand across every seed.
  const lightness = useMemo(() => {
    const seed = (member.userId || member.name || member.sessionId)
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    return 22 + (seed % 20);
  }, [member.userId, member.name, member.sessionId]);
  const initial = (member.name?.trim()?.[0] || "?").toUpperCase();
  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border-2 transition-all bg-muted min-h-[220px]",
        hero
          ? "aspect-[4/5] sm:aspect-video sm:min-h-[360px]"
          : tall
            ? "aspect-[3/4] sm:aspect-square"
            : "aspect-square",
        speaking
          ? "border-[hsl(var(--signal-teal))] shadow-[0_0_0_4px_hsl(var(--signal-teal)/0.25)]"
          : "border-border/40",
      )}
    >
      {showVideo ? (
        <div className="absolute inset-0 bg-black">
          <VideoTrackView
            track={videoTrack!}
            muted={member.isLocal}
            mirror={member.isLocal}
          />
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `hsl(327 65% ${lightness}%)`,
          }}
        >
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span
              className={cn(
                "font-black text-white drop-shadow-lg",
                hero ? "text-7xl sm:text-8xl" : "text-4xl sm:text-5xl",
              )}
            >
              {initial}
            </span>
          )}
          {/* Camera-off / loading chip */}
          <span className="absolute bottom-12 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white text-[10px] font-semibold">
            <VideoOff className="h-3 w-3" />
            {member.videoState === "loading" || member.videoState === "sendable"
              ? "Starting camera"
              : "Camera off"}
          </span>
        </div>
      )}

      {/* Top-left: host crown -- already carries real "Host" text, not just the icon */}
      {member.role === "host" && (
        <span className="absolute top-2 left-2 h-6 px-1.5 rounded-full bg-amber-500 text-white flex items-center gap-1 text-[10px] font-black uppercase">
          <Crown aria-hidden="true" className="h-3 w-3" /> Host
        </span>
      )}

      {/* Top-right: host menu */}
      {showHostMenu && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onMute?.(member)}>
                <MicOff className="h-3.5 w-3.5 mr-2" /> Mute
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDemote?.(member)}>
                <Hand className="h-3.5 w-3.5 mr-2" /> Move to audience
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemove?.(member)}
              >
                <X className="h-3.5 w-3.5 mr-2" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Bottom bar: name + mute */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-2">
        <p className="flex-1 text-xs font-bold text-white truncate drop-shadow">
          {member.isLocal ? "You" : member.name.split(" ")[0]}
          {statusText && <span className="sr-only">, {statusText}</span>}
        </p>
        {!member.audioOn ? (
          <span aria-hidden="true" className="h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
            <MicOff className="h-3 w-3" />
          </span>
        ) : speaking ? (
          <span aria-hidden="true" className="h-6 w-6 rounded-full bg-[hsl(var(--signal-teal))] text-black flex items-center justify-center animate-pulse">
            <Mic className="h-3 w-3" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function VideoTrackView({
  track,
  muted,
  mirror,
}: {
  track: MediaStreamTrack;
  muted?: boolean;
  mirror?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = new MediaStream([track]);
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [track]);

  // TODO(ios-black-tile): documented, unaddressed iOS Safari/WKWebView bug —
  // a remote participant's video tile can render as a solid black rectangle
  // even though `track` is live, `srcObject` is set, and `el.play()`
  // resolved without error. Reported (by us) most often after: (a) the app
  // is backgrounded and foregrounded (Capacitor app-switcher on iOS, or
  // Safari tab-switching), and (b) rejoining a stage after having left it.
  // Audio keeps working the whole time -- only the <video> paint is wrong --
  // which matches a real WebKit regression, not a track/connection problem:
  // https://bugs.webkit.org/show_bug.cgi?id=230922 ("Autoplayed video
  // element with mediaStream srcObject freezes", iOS 15+) and third-party
  // reports of the identical "black tile after rejoin" symptom in other
  // WebRTC SDKs' custom-UI iOS Safari integrations (e.g.
  // github.com/aws/amazon-chime-sdk-js/issues/957). We could not find a
  // first-party Daily.co-documented fix for this in their public docs
  // (checked docs.daily.co/docs/browsers and the daily-js changelogs) --
  // Daily's own Prebuilt UI shipped a related "video track retains last
  // frame on iOS Safari" fix in 2023, but this codebase uses daily-js's
  // custom call-object API with a hand-rolled <video> per tile (this
  // function), not Prebuilt, so that upstream fix doesn't cover us.
  //
  // What's below is a best-effort mitigation, NOT a confirmed fix: force a
  // full detach/reattach of srcObject when the page regains visibility,
  // since the WebKit bug above is specifically about a frozen/blank paint
  // surviving until something forces the video element to re-evaluate its
  // source. If this stage is still seeing black tiles on iOS after this
  // ships, the next step is a minimal repro against daily-js directly (no
  // custom rendering) to determine whether it's this app's tile rendering
  // or a daily-js/WebKit issue upstream of it, then file/upvote with Daily.
  useEffect(() => {
    const handleVisibility = () => {
      const el = ref.current;
      if (!el || document.visibilityState !== "visible") return;
      const current = el.srcObject;
      el.srcObject = null;
      // Re-attach on the next frame so WebKit actually treats this as a new
      // source rather than a no-op re-assignment.
      requestAnimationFrame(() => {
        if (!ref.current) return;
        ref.current.srcObject = current ?? new MediaStream([track]);
        void ref.current.play().catch(() => undefined);
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="h-full w-full object-cover"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

function CamPreview({
  stream,
  mirror,
}: {
  stream: MediaStream;
  mirror?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="h-full w-full object-cover"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

function MicCheckScreen({
  level,
  userName,
  userAvatar,
  isHost,
  mode,
  camStream,
  onJoin,
  onCancel,
  backstage = false,
}: {
  level: number;
  userName: string;
  userAvatar?: string | null;
  isHost: boolean;
  mode: "audio" | "video";
  camStream: MediaStream | null;
  onJoin: () => void;
  onCancel: () => void;
  backstage?: boolean;
}) {
  const detected = level > 0.04;
  const bars = 12;
  const lit = Math.round(level * bars * 1.4);
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-6 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-black">
          {mode === "video" ? "Camera + mic check" : "Mic check"}
        </h2>
        <p className="text-xs text-muted-foreground max-w-xs">
          {mode === "video"
            ? "Check yourself out — see your video and watch the bars light up. You're not live until you tap below."
            : "Say something — you should see the bars light up. This is just for you; you're not live until you tap below."}
        </p>
      </div>

      {mode === "video" ? (
        <div
          className="relative rounded-2xl overflow-hidden bg-black border-2 transition-colors w-full max-w-xs aspect-video"
          style={{
            borderColor: detected
              ? "hsl(var(--signal-teal))"
              : "hsl(var(--border))",
            boxShadow: detected
              ? `0 0 0 ${4 + Math.round(level * 12)}px hsl(var(--signal-teal) / 0.22)`
              : undefined,
          }}
        >
          {camStream ? (
            <CamPreview stream={camStream} mirror />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Warming up
              camera…
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className="rounded-full p-1 transition-all"
            style={{
              background: detected ? "hsl(var(--signal-teal))" : "transparent",
              boxShadow: detected
                ? `0 0 0 ${6 + Math.round(level * 18)}px hsl(var(--signal-teal) / 0.22)`
                : undefined,
            }}
          >
            <Avatar className="h-24 w-24 ring-2 ring-background">
              <AvatarImage src={userAvatar ?? undefined} />
              <AvatarFallback className="text-2xl font-black">
                {userName[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      )}

      {/* VU bars */}
      <div className="flex items-end gap-1 h-10">
        {Array.from({ length: bars }).map((_, i) => {
          const active = i < lit;
          const h = 8 + (i / bars) * 28;
          return (
            <div
              key={i}
              className={cn(
                "w-1.5 rounded-full transition-colors",
                active
                  ? i < bars * 0.6
                    ? "bg-[hsl(var(--signal-teal))]"
                    : i < bars * 0.85
                      ? "bg-[hsl(var(--signal-amber))]"
                      : "bg-[hsl(var(--signal-pink))]"
                  : "bg-muted",
              )}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      <p
        className={cn(
          "text-xs font-semibold",
          detected ? "text-[hsl(var(--signal-teal))]" : "text-muted-foreground",
        )}
      >
        {detected ? "Mic is hot ✓" : "No sound detected — try speaking"}
      </p>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          size="lg"
          className={cn("rounded-full h-12 text-sm font-bold", STAGE_CTA_PRIMARY)}
          style={STAGE_CTA_GRADIENT_STYLE}
          onClick={onJoin}
          disabled={mode === "video" && !camStream}
        >
          {mode === "video" ? (
            <Video className="h-4 w-4 mr-2" />
          ) : (
            <Mic className="h-4 w-4 mr-2" />
          )}
          {isHost ? (backstage ? "Open doors & go live" : "Go live on stage") : "Join the room"}
        </Button>
        <Button
          variant="ghost"
          className="rounded-full h-10 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
