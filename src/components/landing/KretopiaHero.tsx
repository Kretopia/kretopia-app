/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * Copy locked per GTM review: leads with the immediate desire (find work
 * that fits what you do) before the mechanism (Creative Passport), states
 * the Passport in plain English instead of assuming it's understood, and
 * surfaces Scout in the hero since it's now a primary reason to build a
 * Passport in the first place. Two CTAs of equal weight: build the
 * Passport, or go straight to what it unlocks (Scout). No third action
 * competing with them -- the real "claim your record by searching your
 * name" flow this hero used to front-end is reachable through the site's
 * persistent navbar search (now shown on the landing page too, see
 * Navbar.tsx), not duplicated here.
 *
 * Background: "Verified Creative Signal Field" -- replaces an earlier
 * multicolor aurora that, per direct feedback and a read-only audit
 * (LANDING_HERO_SIGNAL_FIELD_AUDIT.md), mixed five hues (including green,
 * reserved for KrePay) and directly contradicted a house rule already
 * encoded in index.css: the old multi-color "Signal Triad" tokens
 * (--signal-pink/amber/violet/teal) were deliberately retired down to one
 * dominant accent (--energy). This field is built around that one accent
 * plus --secondary (the same grey used in .btn-landing-primary's own
 * gradient) -- one restrained grey-to-pink field, a few decorative proof
 * nodes, and the official KretoMark at low opacity. Text first, CTA
 * second, field always subordinate to both.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { KretoCharacter, type KretoCharacterVariant } from "@/components/brand/KretoCharacter";

/** Headline, split into words per line so each can resolve out of a blur on
 *  load. Line 1 renders in the default white; line 2 is wrapped in
 *  .landing-accent (the canonical pink/italic/glow accent already used for
 *  this exact role elsewhere on Landing) so every word in it inherits the
 *  color/style without needing a per-word class. */
const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do."];

/** 6 satellites plus the big main figure (rendered separately below, not
 *  in this array) -- spread across corners, a mid-left point AND the
 *  section's own top/bottom padding bands (above the brand lockup, below
 *  the CTA/trust line) for real full-page coverage ("répartis
 *  proportionnelement partout") instead of clustering near the edges
 *  ("ça fait trop pâté"). The two padding-band slots used to repeat
 *  connector/producer a second time each at an identical 60px -- direct
 *  feedback flagged those as visibly duplicated ("robots en double") and
 *  asked for real cutout variety and varying sizes instead, so they're
 *  now the two new alpha-cutout variants (director, detective), each a
 *  distinct size rather than matching pair. The two padding-band entries
 *  can sit at any horizontal position because they're vertically outside
 *  the text entirely; the rest stay inside the margin that's clear even
 *  at the tightest desktop width this renders at (exactly `lg`, 1024px,
 *  ~62px outside the centered max-w-[900px] column before its own
 *  internal padding even starts). No float, no hover-knock on any of
 *  these -- "annule l'effet ballons et rends les fixes" -- so none of
 *  the props below include floatAmplitude/hoverable; every instance
 *  renders fully static. */
const HERO_FLOATERS: Array<{
  variant: KretoCharacterVariant;
  size: number;
  className: string;
}> = [
  { variant: "scout", size: 92, className: "top-16 left-10" },
  { variant: "connector", size: 90, className: "top-16 right-10" },
  { variant: "producer", size: 88, className: "bottom-16 left-10" },
  { variant: "publicist", size: 86, className: "top-72 left-4" },
  { variant: "director", size: 76, className: "top-4 left-[36%]" },
  { variant: "detective", size: 64, className: "bottom-4 right-[36%]" },
];

interface KretopiaHeroProps {
  /** Kept for backward compatibility with the search-first flow this hero
   *  used to front — no longer called from here (see file header). */
  onSearchSubmit?: (query: string) => void;
}

const wordVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] as const } },
      };

export const KretopiaHero = (_props: KretopiaHeroProps) => {
  const reducedMotion = useReducedMotion();

  // The signal field's only pointer interaction: its center offsets a
  // small, capped amount toward the cursor -- one field responding, not
  // several independent layers drifting. Spring-smoothed so it settles
  // rather than snapping. Disabled entirely under reduced motion.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothX = useSpring(pointerX, { stiffness: 40, damping: 22, mass: 0.6 });
  const smoothY = useSpring(pointerY, { stiffness: 40, damping: 22, mass: 0.6 });
  const fieldX = useTransform(smoothX, [0, 1], [-24, 24]);
  const fieldY = useTransform(smoothY, [0, 1], [-14, 14]);

  const handlePointerMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  };
  const handlePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

  useEffect(() => {
    analytics.featureUsed("landing_hero_viewed", { location: "hero" });
    // Section-view tracking for "kretopia-hero" is handled generically by
    // LandingFunnelTracker (observes every real section[id] in the DOM) --
    // not duplicated here.
  }, []);

  return (
    <section
      id="kretopia-hero"
      className="relative overflow-hidden"
      style={{ backgroundColor: "#05070D" }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      {/* warm vignette — barely there */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 80% 20%, rgba(120, 70, 40, 0.14), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.6), transparent 60%)",
        }}
      />

      {/* Verified Creative Signal Field — one restrained grey-to-pink radial
          field (the same --secondary -> --energy pair as the primary CTA's
          own gradient, not a new color pairing) and the official KretoMark
          at low opacity. Replaces the earlier multicolor aurora entirely --
          see file header and LANDING_HERO_SIGNAL_FIELD_AUDIT.md for why.
          The proof-node constellation (decorative dots/lines) that shipped
          in the first pass was removed per direct feedback -- a more
          carefully-scoped version (peripheral-only, never crossing the
          title) is planned separately. Midnight base and the faint
          coordinate grid below are unchanged; they already matched the
          brief before this pass. Everything here is aria-hidden -- purely
          decorative, no live data implied. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ x: fieldX, y: fieldY }}
      >
        <div
          className="h-[70vh] w-[70vh] max-h-[560px] max-w-[560px] rounded-full blur-[90px]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--secondary) / 0.55) 0%, hsl(var(--energy) / 0.22) 42%, transparent 72%)",
          }}
        />
      </motion.div>

      {/* Faint signal grid, masked to fade out — the "machine" layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 55% at 50% 35%, #000 0%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-[900px] px-5 sm:px-8 lg:px-12 pt-16 sm:pt-24 lg:pt-28 pb-20 sm:pb-28 text-center flex flex-col items-center">
        {/* Same brand lockup as the Navbar (BrandLogo, K + wordmark + Beta
            pill) -- direct feedback asked for identical branding here,
            not the earlier faint bare K-mark watermark. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <BrandLogo size="md" showBeta />
        </motion.div>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="landing-eyebrow mb-6"
        >
          For creative professionals
        </motion.p>

        {/* Headline — leads with the immediate desire (find work that fits
            what you do) rather than the mechanism. Words reveal one by one
            out of a blur on load; line 2 is wrapped in .landing-accent, the
            canonical pink/italic/glow treatment already used for this exact
            role elsewhere on Landing. */}
        <h1 className="landing-h1 landing-glow max-w-full mx-auto">
          <motion.span
            className="block"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reducedMotion ? 0 : 0.05 } } }}
          >
            <span className="block">
              {LINE_1.map((word, wi) => (
                <motion.span key={wi} className="inline-block" variants={wordVariants(reducedMotion)}>
                  {word}
                  {wi < LINE_1.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </span>
            <span className="landing-accent block">
              {LINE_2.map((word, wi) => (
                <motion.span key={wi} className="inline-block" variants={wordVariants(reducedMotion)}>
                  {word}
                  {wi < LINE_2.length - 1 ? " " : ""}
                </motion.span>
              ))}
            </span>
          </motion.span>
        </h1>

        {/* Supporting line — the bigger Kretopia philosophy, one notch
            louder than the body copy below it. */}
        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 sm:mt-7 max-w-[34rem] mx-auto text-base sm:text-lg font-medium text-white/85"
          style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
        >
          Your past work should help create your next opportunity.
        </motion.p>

        {/* Body copy — the Passport explained in plain English, with Scout
            named directly since it's now a primary reason to build one. */}
        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="landing-sub mt-3 sm:mt-4 max-w-[38rem] mx-auto"
        >
          Your Creative Passport is a living record of your real projects, credits and skills.
          Get your work co-signed, then let Scout surface opportunities that fit what you've
          already proved.
        </motion.p>

        {/* CTA pair — build the Passport, or go straight to what it
            unlocks. Both the same size, neither shouting over the other. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-9 sm:mt-10 flex flex-col items-center gap-4"
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/auth?tab=signup&src=hero_passport"
              onClick={() =>
                trackLandingCta("hero_build_passport", "hero", {
                  label: "Build My Passport",
                  variant: "signal_field",
                })
              }
              className="btn-landing-primary group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Build My Passport
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>

            <Link
              to="/auth?next=/scout&src=hero_explore"
              onClick={() =>
                trackLandingCta("hero_explore_opportunities", "hero", {
                  label: "Explore Opportunities",
                  variant: "signal_field",
                })
              }
              className="btn-glass btn-glass-outline inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Explore Opportunities
            </Link>
          </div>

          <p
            className="text-xs text-white/45"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            Free to start. No credit card needed.
          </p>
        </motion.div>
      </div>

      {/* Kreto's real, owned character render (KRETO_CHARACTER_ASSET_REPORT.md)
          -- 6 satellite role variants plus the big main figure, all fully
          static per direct feedback cancelling the earlier balloon-hover
          effect ("annule l'effet ballons et rends les fixes"). Desktop
          only (lg+): the content column fills nearly the full width below
          that breakpoint (confirmed in LANDING_HERO_AVATAR_ASSET_AUDIT.md),
          so there's no genuine peripheral space for any of this without
          risking overlap on tablet/mobile. */}
      {HERO_FLOATERS.map((floater, i) => (
        <div
          key={`${floater.variant}-${i}`}
          className={cn("pointer-events-none absolute hidden lg:block opacity-90", floater.className)}
        >
          <KretoCharacter variant={floater.variant} size={floater.size} floatAmplitude={0} />
        </div>
      ))}
      {/* The main figure stays fixed (no idle drift, no hover-knock),
          shifted further left and bigger per direct feedback -- but a
          single fixed size/position can't satisfy that AND stay clear of
          the headline at every width this renders at: checked live at
          1024/1280/1400/1440, the requested 300px size at this position
          genuinely overlapped the H1 at both `lg` (1024px, ~98px of real
          intersection) AND `xl` (1280px, ~29x14px -- the headline itself
          grows wider there too, not just the character), first clearing
          it with real margin (~31px at 1400px, ~51px at 1440px) from
          1440px up. So this is two sized/positioned instances gated to
          their own breakpoint window (an arbitrary Tailwind variant,
          since neither `xl` nor `2xl` lands at 1440) instead of one
          guessed number -- always visible from `lg` up, just smaller and
          closer to the true corner through the 1024-1439px band where
          there isn't room for more. Ground shadow intact under its feet
          in both (KretoCharacter's own mask keeps that area solid). */}
      <div className="pointer-events-none absolute bottom-4 right-6 hidden lg:block min-[1440px]:hidden opacity-95">
        <KretoCharacter variant="main" size={180} floatAmplitude={0} />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-16 hidden min-[1440px]:block opacity-95">
        <KretoCharacter variant="main" size={300} floatAmplitude={0} />
      </div>

      {/* bottom dissolve to next section */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(5,7,13,1))",
        }}
      />
    </section>
  );
};

export default KretopiaHero;
