/**
 * KretoCharacter — Kretopia's real, owned 3D character render of Kreto.
 * Confirmed team-owned asset (not a third-party reference) -- see
 * KRETO_CHARACTER_ASSET_REPORT.md. Five cropped stills from the source
 * "Meet Kreto" artwork: the main character plus four role variants
 * (Scout, Connector, Producer, Publicist).
 *
 * This is a small number of static photographic poses, not a rigged 3D
 * model -- there is exactly one pose per variant, so this component
 * cannot express different facial expressions per app state the way the
 * abstract KretoPresence can. State is instead layered on top as a small
 * signal-dot badge (same accent-dot language as KretoPresence, same
 * honesty rule: only render a non-idle badge when something real is
 * happening) plus the same paired sr-only text announcement -- state is
 * still never color/motion alone.
 *
 * Every variant now uses a real alpha-channel cutout (background
 * removed) -- direct feedback flagged the earlier CSS radial-mask
 * approach on "main" as still reading like "a pasted image with a
 * visible box", which is real: a soft edge fade can never fully hide a
 * rectangular source photo's corners. A true cutout has no box to hide
 * in the first place. The four role variants (Scout, Connector,
 * Producer, Publicist) originally kept their source rounded-square
 * tile treatment; a later pass ("remove the background behind the Kreto
 * Robots") replaced those tiles with the same free, local flood-fill
 * cutout pipeline already used for "main"/"director"/"detective" --
 * see git history for the removed source JPGs. "main"'s own grounding
 * shadow stays specific to that one variant, not extended to the
 * others, since it was tuned for that exact pose/base.
 *
 * `hoverable` makes the cast feel alive to a real pointer, per direct
 * feedback ("comme des ballons... flotter dans l'air"): idle motion
 * drifts on both axes like a buoyant balloon, and a real hover knocks
 * the character to a random nearby spot with a springy, elastic
 * transition, settling back into its own drift once the pointer
 * leaves -- off by default everywhere else.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import kretoMain from "@/assets/brand/kreto/kreto-main-cutout.png";
import kretoScout from "@/assets/brand/kreto/kreto-scout-cutout.png";
import kretoConnector from "@/assets/brand/kreto/kreto-connector-cutout.png";
import kretoProducer from "@/assets/brand/kreto/kreto-producer-cutout.png";
import kretoPublicist from "@/assets/brand/kreto/kreto-publicist-cutout.png";
import kretoDirector from "@/assets/brand/kreto/kreto-director-mic.png";
import kretoDetective from "@/assets/brand/kreto/kreto-detective-scout.png";

export type KretoCharacterVariant = "main" | "scout" | "connector" | "producer" | "publicist" | "director" | "detective";
export type KretoCharacterState =
  | "idle"
  | "attentive"
  | "listening"
  | "processing"
  | "proposal_ready"
  | "success"
  | "caution"
  | "error"
  | "offline";

const VARIANT_SRC: Record<KretoCharacterVariant, string> = {
  main: kretoMain,
  scout: kretoScout,
  connector: kretoConnector,
  producer: kretoProducer,
  publicist: kretoPublicist,
  director: kretoDirector,
  detective: kretoDetective,
};

const VARIANT_LABEL: Record<KretoCharacterVariant, string> = {
  main: "Kreto",
  scout: "Kreto — Scout",
  connector: "Kreto — Connector",
  producer: "Kreto — Producer",
  publicist: "Kreto — Publicist",
  director: "Kreto — Director",
  detective: "Kreto — Detective",
};

/** Every variant is a real alpha-channel cutout (background removed) --
 *  no rounded-tile card, no border/shadow, free-floating silhouette.
 *  Kept as an explicit set (rather than just "always true") so a future
 *  variant added without a real cutout asset still gets the tile
 *  treatment by default instead of silently rendering a raw rectangular
 *  photo with no mask. */
const CUTOUT_VARIANTS = new Set<KretoCharacterVariant>([
  "main", "scout", "connector", "producer", "publicist", "director", "detective",
]);

/** Same wording as KretoPresence's STATE_LABEL, kept in sync deliberately
 *  -- one honest vocabulary for "what is Kreto doing", regardless of
 *  which visual (abstract mark or real character) is rendering it. */
const STATE_LABEL: Record<KretoCharacterState, string> = {
  idle: "",
  attentive: "",
  listening: "Kreto is listening",
  processing: "Kreto is working on this",
  proposal_ready: "Kreto has a suggestion ready",
  success: "Kreto completed the action",
  caution: "Kreto needs you to review something before it continues",
  error: "Kreto needs your attention",
  offline: "Kreto is unavailable right now",
};

function badgeColor(state: KretoCharacterState): string {
  switch (state) {
    case "caution":
      return "hsl(var(--warning))";
    case "error":
    case "offline":
      return "hsl(var(--muted-foreground))";
    default:
      return "hsl(var(--energy))";
  }
}

interface KretoCharacterProps {
  variant?: KretoCharacterVariant;
  /** Pixel width; height follows the source image's own aspect ratio. */
  size?: number;
  state?: KretoCharacterState;
  label?: string;
  className?: string;
  /** How far the idle float travels, in px. Vary per instance so a group
   *  of these doesn't visibly move in lockstep. */
  floatAmplitude?: number;
  /** Full float cycle length, in seconds. */
  floatDuration?: number;
  /** Delay before the float starts, in seconds -- the other half of
   *  breaking lockstep motion across multiple instances. */
  floatDelay?: number;
  /** Balloon-like hover reaction: knocks the character to a random nearby
   *  spot with a springy transition instead of a small in-place wiggle --
   *  off by default since most instances are purely decorative background
   *  elements with no reason to intercept pointer events at all. When on,
   *  only this element (not its absolutely-positioned wrapper) re-enables
   *  pointer events, so it can't steal clicks meant for anything else
   *  nearby. */
  hoverable?: boolean;
}

export const KretoCharacter = ({
  variant = "main",
  size = 160,
  state = "idle",
  label,
  className,
  floatAmplitude = 6,
  floatDuration = 6,
  floatDelay = 0,
  hoverable = false,
}: KretoCharacterProps) => {
  const reducedMotion = useReducedMotion();
  const isMain = variant === "main";
  const isCutout = CUTOUT_VARIANTS.has(variant);
  const showBadge = state !== "idle" && state !== "attentive";
  // Real state, not a fake gesture: only set while the pointer is actually
  // over this element (onHoverStart/End below), cleared the moment it
  // leaves so the character drifts back into its own idle float.
  const [knock, setKnock] = useState<{ x: number; y: number } | null>(null);

  // A balloon drifts on both axes, not just up and down -- a touch of
  // lateral motion on a slightly offset cycle is what makes it read as
  // buoyant rather than a mechanical bob. `rotate: 0` is explicit and
  // required, not decorative: Framer Motion leaves a property untouched
  // when a later `animate` target omits it, so without this the knock's
  // tilt would stick permanently once the pointer leaves.
  const idleAnimate = reducedMotion
    ? undefined
    : { y: [0, -floatAmplitude, 0], x: [0, floatAmplitude * 0.5, 0, -floatAmplitude * 0.35, 0], rotate: 0 };
  // `rotate` gets its own quick tween here -- without this override it
  // would inherit the same multi-second looping duration as the x/y
  // drift, which reads as the tilt from a knock "sticking" for several
  // seconds instead of settling back out promptly.
  const idleTransition = {
    default: { duration: floatDuration, delay: floatDelay, repeat: Infinity, ease: "easeInOut" as const },
    rotate: { duration: 0.5, ease: "easeOut" as const },
  };
  const knockTransition = { type: "spring" as const, stiffness: 140, damping: 9 };

  const handleHoverStart = () => {
    if (!hoverable || reducedMotion) return;
    // A real random direction/distance each time -- "les envoyer partout
    // comme des ballons" -- not the same nudge every time. Capped at 80px:
    // the satellites got bigger, so the same knock distance would reach
    // further into the centered text column than before.
    const angle = Math.random() * Math.PI * 2;
    const distance = 36 + Math.random() * 44;
    setKnock({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance - 24 });
  };
  const handleHoverEnd = () => {
    if (!hoverable) return;
    setKnock(null);
  };

  return (
    <motion.div
      className={cn("relative inline-block", hoverable && "pointer-events-auto cursor-default", className)}
      style={{ width: size }}
      animate={knock ? { x: knock.x, y: knock.y, rotate: knock.x > 0 ? 12 : -12 } : idleAnimate}
      transition={knock ? knockTransition : idleTransition}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      aria-hidden="true"
    >
      {isMain && (
        // Grounding shadow -- a deliberate CSS ellipse standing in for the
        // real cutout's now-removed background shadow, so the character
        // still reads as standing on something regardless of what's behind
        // it, instead of depending on one exact background matching a
        // baked-in photo shadow.
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 bottom-[6%] -translate-x-1/2 rounded-[50%] blur-md"
          style={{ width: "58%", height: "10%", background: "radial-gradient(closest-side, rgba(0,0,0,0.45), transparent)" }}
        />
      )}
      <img
        src={VARIANT_SRC[variant]}
        alt=""
        draggable={false}
        className={cn("relative w-full h-auto select-none", isCutout ? "" : "rounded-2xl")}
        style={
          isCutout
            ? undefined
            : {
                boxShadow: "0 0 0 1px hsl(var(--border) / 0.4), 0 10px 28px -12px rgba(0,0,0,0.6)",
              }
        }
      />

      {showBadge && (
        <span
          aria-hidden
          className="absolute top-[10%] right-[10%] h-2.5 w-2.5 rounded-full ring-2 ring-background"
          style={{ backgroundColor: badgeColor(state) }}
        />
      )}

      <span className="sr-only">
        {label || VARIANT_LABEL[variant]}
        {showBadge ? ` — ${STATE_LABEL[state]}` : ""}
      </span>
    </motion.div>
  );
};

export default KretoCharacter;
