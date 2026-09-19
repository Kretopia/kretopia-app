/**
 * ClosingCTASection — Phase 13. The page's final conversion moment, not a
 * feature list.
 *
 * The primary action is a direct `<Link to="/auth?tab=signup">` — the same
 * destination every other signup CTA on this landing page already uses
 * (ClaimYourCreditsSection, ForOrganisationsSection, ProductSectionThrive,
 * etc.), styled with the same accent pill button. An earlier version put a
 * decorative, non-functional search-field lookalike here that only scrolled
 * back up to the hero and refocused the real search input — an extra,
 * avoidable step (scroll up, re-locate the field, retype) between a
 * convinced visitor and completing signup. Removed in favor of one clear
 * button plus a short trust line answering the objections that actually
 * block signup (cost, commitment, time), and a secondary "already have an
 * account" path for returning visitors so the section isn't a dead end for
 * them either.
 *
 * This is the landing page's one FixedProgressiveCard (Section 7 of the
 * overhaul) — the primary-CTA, step-10 moment of the storytelling
 * structure, and the only place on the page content is pinned and
 * revealed by scroll progress rather than a plain fade-in-on-view. The
 * eight chapters above it keep their existing whileInView treatment
 * deliberately; this pattern is reserved for the one true "landing" beat.
 *
 * The title is a live, real social-proof headline — the real creator
 * count from the same public-stats edge function the app already uses
 * for its own stats surfaces (no new backend). Fetched on mount (this
 * section renders off-screen from the very start of the page, so by the
 * time a visitor scrolls this far down the real number has almost
 * always already loaded); the fallback copy carries no invented number
 * and reads naturally on its own, so a slow network never shows a
 * broken or blank headline — see useCreatorCount below.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FixedProgressiveCard } from "@/components/landing/kretopia/FixedProgressiveCard";
import { trackLandingCtaClick } from "@/lib/landingMetrics";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#FF2DA1";

const trackSignupClick = () =>
  trackLandingCtaClick({
    ctaId: "claim_your_creative_passport",
    section: "closing_cta",
    label: "Claim Your Creative Passport",
    destinationType: "auth",
  });
const trackSigninClick = () =>
  trackLandingCtaClick({
    ctaId: "closing_cta_signin",
    section: "closing_cta",
    label: "Already have an account? Sign in",
    destinationType: "auth",
  });

/** Real, live creator count from public-stats (same source the rest of the
 *  app already trusts for stats). Null until loaded or if the fetch fails
 *  — callers must have a fallback that reads fine without a number. */
function useCreatorCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("public-stats")
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const n = data?.stats?.creators;
        if (typeof n === "number" && n > 0) setCount(n);
      })
      .catch(() => {
        /* silent — the fallback copy carries no number, nothing to fix */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

export const ClosingCTASection = () => {
  const creatorCount = useCreatorCount();

  return (
    <section
      id="closing-cta"
      className="landing-section relative border-t border-white/[0.05]"
      style={{ backgroundColor: "#05070D" }}
      aria-labelledby="closing-cta-title"
    >
      <FixedProgressiveCard
        eyebrow={<p className="landing-eyebrow">Get started</p>}
        title={
          <h2 id="closing-cta-title" className="landing-h1 landing-glow">
            {creatorCount ? `Join ${creatorCount}+ creatives` : "Join the creatives"}
            <br />
            <span className="italic pink-glow-breathe" style={{ color: ACCENT }}>already proving their work.</span>
          </h2>
        }
        keyValue={
          // Glow sits behind the button on its own layer rather than as a
          // box-shadow so it can blur past the button's own rounded-full
          // edge without being clipped by btn-glass's overflow:hidden.
          <div className="relative inline-block">
            <div
              aria-hidden
              className="ai-ambient-breathe pointer-events-none absolute -inset-4 rounded-full blur-2xl"
              style={{ background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)` }}
            />
            <Link
              to="/auth?tab=signup&intent=closing_cta&src=closing_cta"
              onClick={trackSignupClick}
              className="btn-landing-primary group relative inline-flex h-auto items-center gap-2 rounded-full px-8 py-4 text-base font-semibold"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            >
              Claim Your Creative Passport
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        }
        supportingItem={
          <p className="text-xs text-white/45" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            Free forever · No credit card · 2-minute setup
          </p>
        }
        cta={
          <Link
            to="/auth?src=closing_cta"
            onClick={trackSigninClick}
            className="text-xs font-medium text-white/40 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white/70"
            style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
          >
            Already have an account? Sign in
          </Link>
        }
      />

      {/* No extra pb-* here -- .landing-section already supplies this
          section's own bottom padding (see index.css); stacking another
          4-5rem on top of it was the "large margin before FAQ" the rest
          of the page's vertical rhythm doesn't otherwise have. */}
      <p
        className="relative text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50"
        style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
      >
        Kretopia
        <br />
        Where Creativity Lives.
      </p>
    </section>
  );
};

export default ClosingCTASection;
