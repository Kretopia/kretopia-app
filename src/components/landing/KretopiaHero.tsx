/**
 * KretopiaHero — Section 1 of the Kretopia landing page.
 *
 * v4: the dropdown now searches real opportunities in real time instead of
 * matching taxonomy terms — as the user types (2+ chars), a debounced
 * (250ms), abort-on-keystroke request hits /api/works/search?q=... and
 * results (title + role/location/type) render live, ranked by whatever
 * the endpoint returns. Debounce + AbortController means only the latest
 * keystroke's request ever resolves into state, so fast typing can't
 * flash stale results. A fetch failure now fails silently into the same
 * empty state as "no matches" rather than showing technical copy.
 * "Find work on Kretopia" now sits mb-4/sm:mb-5 above the input (was
 * mb-2) for real breathing room.
 *
 * IMPORTANT — this is not yet wired to a real endpoint. I looked for a
 * Supabase project backing Kretopia to query real data directly, but
 * found none named "Kretopia" among the connected projects, and the
 * existing ones (ThriveIN, ThriveIN Beta, GIG, etc.) are all currently
 * paused, so I can't confirm which one — if any — is live data. Point
 * `searchWorkOpportunities` below at the real endpoint (REST route,
 * Supabase table/RPC, or an existing `useWorkSearch`-style hook) once
 * that's confirmed — the debounce/abort/render logic around it doesn't
 * need to change.
 *
 * Background: "Verified Creative Signal Field" — unchanged (see
 * LANDING_HERO_SIGNAL_FIELD_AUDIT.md).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Search, X } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { analytics } from "@/lib/analytics";
import { trackLandingCta } from "@/lib/landingFunnel";
import { BrandLogo } from "@/components/BrandLogo";
import { KretoCharacter } from "@/components/brand/KretoCharacter";

/** Headline, split into words per line so each can resolve out of a blur on
 *  load. Spacing between words comes from a margin on every span but the
 *  line's last, not a text-node space (which is what was collapsing). */
const LINE_1 = ["Find", "work", "that", "fits"];
const LINE_2 = ["what", "you", "do."];

interface WorkOpportunity {
  id: string;
  title: string;
  role?: string;
  location?: string;
  workType?: string;
}

/** ASSUMPTION: point this at the real search endpoint/hook — see file
 *  header. Kept as a small standalone function (not a hook) so the
 *  debounce/abort logic around it can live in the component and stay
 *  easy to follow. */
async function searchWorkOpportunities(query: string, signal: AbortSignal): Promise<WorkOpportunity[]> {
  const res = await fetch(`/api/works/search?q=${encodeURIComponent(query)}&limit=8`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function highlightMatch(label: string, query: string) {
  const idx = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <span style={{ color: "hsl(var(--energy))" }}>{label.slice(idx, idx + query.length)}</span>
      {label.slice(idx + query.length)}
    </>
  );
}

interface KretopiaHeroProps {
  /** Optional hook into a shared search flow the app may already have
   *  (e.g. the same logic behind Navbar's UnifiedSearchDropdown). Fired
   *  with the raw typed query on a free-text submit (Enter with nothing
   *  highlighted, or "See all results"). Picking a specific live result
   *  always navigates straight to it, regardless of this prop. */
  onSearchSubmit?: (query: string) => void;
}

const wordVariants = (reducedMotion: boolean) =>
  reducedMotion
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] as const } },
      };

export const KretopiaHero = ({ onSearchSubmit }: KretopiaHeroProps) => {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();

  // Signal field pointer response — unchanged.
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

  // --- Work search state ---
  const [workQuery, setWorkQuery] = useState("");
  const [results, setResults] = useState<WorkOpportunity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced, abortable, real-time search. Only the response for the
  // latest keystroke's request is ever applied.
  useEffect(() => {
    const q = workQuery.trim();
    setActiveIndex(-1);
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }
    setIsOpen(true);
    setIsSearching(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      searchWorkOpportunities(q, controller.signal)
        .then(setResults)
        .catch((err: Error) => {
          if (err.name !== "AbortError") setResults([]); // fail silently, no error copy
        })
        .finally(() => setIsSearching(false));
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [workQuery]);

  // Close on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToOpportunity = (opp: WorkOpportunity) => {
    trackLandingCta("hero_work_result_select", "hero", { label: opp.title, id: opp.id });
    setIsOpen(false);
    navigate(`/works/${opp.id}`);
  };

  const submitRawSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    trackLandingCta("hero_work_search", "hero", { label: "Find work on Kretopia", query: trimmed });
    setIsOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(trimmed);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleWorkSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitRawSearch(workQuery);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToOpportunity(results[activeIndex]);
    }
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

      {/* Verified Creative Signal Field — unchanged. aria-hidden --
          purely decorative, no live data implied. */}
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

        {/* Headline — words spaced with a margin on each span, not a
            trailing space character, so spacing can't collapse. */}
        <h1 className="landing-h1 landing-glow max-w-full mx-auto">
          <motion.span
            className="block"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reducedMotion ? 0 : 0.05 } } }}
          >
            <span className="block">
              {LINE_1.map((word, wi) => (
                <motion.span
                  key={wi}
                  className={`inline-block${wi < LINE_1.length - 1 ? " mr-[0.28em]" : ""}`}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <span className="landing-accent block">
              {LINE_2.map((word, wi) => (
                <motion.span
                  key={wi}
                  className={`inline-block${wi < LINE_2.length - 1 ? " mr-[0.28em]" : ""}`}
                  variants={wordVariants(reducedMotion)}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </motion.span>
        </h1>

        {/* "Works" search — icon + input only. Results are real
            opportunities fetched live (debounced, abortable) as the user
            types, not taxonomy terms. */}
        <motion.form
          ref={formRef}
          onSubmit={handleWorkSearchSubmit}
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-8 sm:mt-9 w-full max-w-[38rem] mx-auto"
        >
          <label htmlFor="kretopia-hero-work-search" className="landing-eyebrow mb-4 sm:mb-5 block text-center">
            Find work on Kretopia
          </label>
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-white/45" aria-hidden />
            <input
              ref={inputRef}
              id="kretopia-hero-work-search"
              type="search"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="kretopia-hero-work-search-listbox"
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `kretopia-hero-result-${activeIndex}` : undefined}
              autoComplete="off"
              value={workQuery}
              onChange={(e) => setWorkQuery(e.target.value)}
              onFocus={() => {
                if (workQuery.trim().length >= 2) setIsOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search by role, skill, location, type of work…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-3.5 pl-11 pr-10 text-sm text-white placeholder:text-white/40 backdrop-blur-sm transition-colors focus:border-[hsl(var(--energy))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--energy)/0.35)]"
              style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}
            />
            {workQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setWorkQuery("");
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white/80"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          {isOpen && (
            <div
              id="kretopia-hero-work-search-listbox"
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0e17]/95 text-left shadow-xl backdrop-blur-md"
            >
              {isSearching && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-white/50">Searching…</p>
              )}
              {!isSearching && results.length === 0 && (
                <p className="px-4 py-3 text-sm text-white/50">No opportunities match "{workQuery.trim()}" yet.</p>
              )}
              {results.map((opp, i) => (
                <button
                  key={opp.id}
                  type="button"
                  role="option"
                  id={`kretopia-hero-result-${i}`}
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToOpportunity(opp)}
                  className={`flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors ${
                    i === activeIndex ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm text-white/90">{highlightMatch(opp.title, workQuery.trim())}</span>
                  {(opp.role || opp.location || opp.workType) && (
                    <span className="mt-0.5 text-xs text-white/45">
                      {[opp.role, opp.location, opp.workType].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
              {results.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submitRawSearch(workQuery)}
                  className="w-full border-t border-white/10 px-4 py-2.5 text-left text-xs font-medium text-white/60 transition-colors hover:text-white/90"
                >
                  See all results for "{workQuery.trim()}"
                </button>
              )}
            </div>
          )}

          <div aria-live="polite" className="sr-only">
            {isOpen && !isSearching ? `${results.length} opportunities found` : ""}
          </div>
        </motion.form>

        {/* CTA pair — unchanged, not in scope for this request. */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
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

          <p className="text-xs text-white/45" style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}>
            Free to start. No credit card needed.
          </p>
        </motion.div>
      </div>

      {/* Big main Kreto figure — unchanged. */}
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