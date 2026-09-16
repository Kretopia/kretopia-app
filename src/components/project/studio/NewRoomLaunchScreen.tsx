import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Check, Share2 } from "lucide-react";
import Confetti from "react-dom-confetti";
import { KretoCharacter } from "@/components/brand/KretoCharacter";
import type { WorkspaceType } from "@/lib/workspaceConfigs";
import { WORKSPACE_CONFIGS } from "@/lib/workspaceConfigs";

interface NewRoomLaunchScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  workspaceType: WorkspaceType;
  taskCount: number;
  onOpenRoom: () => void;
}

// Real semantic token, not a hardcoded hex -- this used to be a literal
// "#FF2DA1" that matched --energy's default value by coincidence, but
// silently diverged from it under the app's alternate "neon" vibe theme
// (data-vibe="neon" .dark sets --energy to a lime/yellow, not pink), so
// this screen would stay pink while every other themed surface correctly
// switched. `hsl(var(--energy))` as a literal string still resolves
// correctly when handed to react-dom-confetti's own inline-style color
// assignment, same as passing it to any other DOM style property.
const ACCENT = "hsl(var(--energy))";
const accentAlpha = (alpha: number) => `hsl(var(--energy) / ${alpha})`;

const confettiConfig = {
  angle: 90,
  spread: 280,
  startVelocity: 55,
  elementCount: 140,
  dragFriction: 0.1,
  duration: 5000,
  stagger: 2,
  width: "10px",
  height: "10px",
  // The two decorative secondary shades stay literal -- confetti variety
  // colors, not a themed UI surface, and there's no existing "lighter/
  // darker energy" token to derive them from without inventing one.
  colors: [ACCENT, "#ffffff", "#ff8ac9", "#B0083F"],
};

/**
 * New Room's "your room is live" celebration -- the project-creation
 * equivalent of ProfileLaunchScreen.tsx (same accent, same confetti config,
 * same header-plate/pride-copy/primary-then-secondary-actions layout),
 * per the ask to make New Room's flow "exactement similaire à la création
 * d'un compte". Shown once, right after a real, confirmed project insert
 * succeeds -- VoiceFirstCreateModal's createProject() opens this instead of
 * silently navigating away.
 */
export function NewRoomLaunchScreen({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  workspaceType,
  taskCount,
  onOpenRoom,
}: NewRoomLaunchScreenProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const config = WORKSPACE_CONFIGS[workspaceType];
  const RoomIcon = config.icon;

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setShowConfetti(true), 250);
      return () => clearTimeout(t);
    }
    setShowConfetti(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-border max-h-[92dvh] overflow-y-auto"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        <DialogTitle className="sr-only">{projectTitle} is ready</DialogTitle>

        <div className="absolute top-0 left-1/4 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-1/2 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>
        <div className="absolute top-0 left-3/4 z-50"><Confetti active={showConfetti} config={confettiConfig} /></div>

        {/* Header — same cinematic aurora plate as ProfileLaunchScreen/tutorial surfaces */}
        <div className="relative pt-10 pb-7 px-6 text-center overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(65% 60% at 50% 0%, ${accentAlpha(0.18)}, transparent 65%)` }}
          />

          <div className="relative">
            <p
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] mb-4 px-2.5 py-1 rounded-full border mx-auto w-fit"
              style={{ borderColor: accentAlpha(0.3), backgroundColor: accentAlpha(0.06), color: ACCENT }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              Your room is live
            </p>

            <div className="flex justify-center mb-3">
              <KretoCharacter size={96} state="success" />
            </div>

            <h2 className="landing-h2 landing-glow text-2xl mb-0.5">{projectTitle}</h2>
            <p className="text-foreground/70 text-sm font-medium inline-flex items-center gap-1.5">
              <RoomIcon className="h-3.5 w-3.5" />
              {config.label}
            </p>

            {taskCount > 0 && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                style={{ borderColor: accentAlpha(0.25), backgroundColor: accentAlpha(0.06), color: "hsl(var(--foreground))" }}
              >
                <Check className="h-3 w-3" style={{ color: ACCENT }} />
                {taskCount} starter task{taskCount === 1 ? "" : "s"} seeded
              </div>
            )}
          </div>
        </div>

        <div className="relative p-5 space-y-5">
          <div className="text-center space-y-1">
            <p className="text-base font-bold text-foreground">
              Nice work<span className="pink-glow-breathe" style={{ color: ACCENT }}>.</span> Kreto set up the room.
            </p>
            <p className="text-xs text-foreground/50">
              Review the structure, then bring in whoever needs to be there.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRoom}
            className="btn-glass btn-glass-primary w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
          >
            <ArrowRight className="h-4 w-4" />
            Open the room
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[10px] text-foreground/30">
            <Share2 className="h-3 w-3" />
            /desk/{projectId.slice(0, 8)}…
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NewRoomLaunchScreen;
