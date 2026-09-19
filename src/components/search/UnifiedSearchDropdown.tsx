import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Database, Briefcase, User, ArrowRight, Loader2, X, UserCheck, Globe, ExternalLink, Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { VoiceWaveform } from "@/components/search/VoiceWaveform";
import { escapePostgrestValue } from "@/lib/postgrestFilter";

interface SearchResult {
  type: "creator" | "credit" | "gig" | "web";
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  bio?: string;
  credits?: { project: string; role: string }[];
  platform?: string;
  is_claimed?: boolean;
  url?: string;
}

interface KnowledgeCard {
  type: string;
  name: string;
  description: string;
  image_url?: string | null;
  known_for?: string[];
  industry?: string;
  platforms?: string[];
  social_links?: Record<string, string>;
  claim_prompt?: string;
}

interface AlternativeMatch {
  name: string;
  description: string;
  image_url?: string | null;
  industry?: string;
  location?: string;
  known_for?: string[];
}

interface UnifiedSearchDropdownProps {
  variant?: "hero" | "navbar" | "inline";
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  autoFocus?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  onSelect?: (result: SearchResult) => void;
  onQuerySubmit?: (query: string) => void;
}

const TYPE_META = {
  creator: { label: "Creator", icon: User, color: "text-primary" },
  credit: { label: "Credit", icon: Database, color: "text-accent" },
  gig: { label: "Gig", icon: Briefcase, color: "text-emerald-500" },
  web: { label: "Discovered", icon: Sparkles, color: "text-amber-500" },
};

// Group headers for the mixed results list — "Users", "Creative Work" and
// "Opportunities" are the three canonical groups; "web" results are
// literally raw web discoveries, not formal project records, so they keep
// their own honest "Discovered" heading rather than being folded into
// "Creative Work" (which would overclaim their provenance).
const RESULT_GROUP_LABEL: Record<SearchResult["type"], string> = {
  creator: "Users",
  credit: "Creative Work",
  gig: "Opportunities",
  web: "Discovered",
};

export function UnifiedSearchDropdown({
  variant = "navbar",
  placeholder = "Search users, work and opportunities",
  value,
  onValueChange,
  autoFocus = false,
  onOpenChange,
  className,
  onSelect,
  onQuerySubmit,
}: UnifiedSearchDropdownProps) {
  const navigate = useNavigate();
  const [internalQuery, setInternalQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [webLoading, setWebLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedCreator, setHighlightedCreator] = useState<SearchResult | null>(null);
  const [knowledgeCard, setKnowledgeCard] = useState<KnowledgeCard | null>(null);
  const [alternativeMatches, setAlternativeMatches] = useState<AlternativeMatch[]>([]);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Escape should close and stay closed — without this, refocusing the
  // input (to return focus after Escape) would immediately reopen the
  // dropdown via onFocus, since the query text is still present.
  const suppressReopenRef = useRef(false);
  const query = value ?? internalQuery;
  const listboxId = useRef(`search-results-${Math.random().toString(36).slice(2)}`).current;

  const setQuery = useCallback((nextValue: string) => {
    if (value === undefined) setInternalQuery(nextValue);
    onValueChange?.(nextValue);
  }, [onValueChange, value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOpenChange]);

  // Debounced search
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setOpen(false);
      onOpenChange?.(false);
      setResults([]);
      setError(false);
      setHighlightedCreator(null);
      setKnowledgeCard(null);
      setAlternativeMatches([]);
      return;
    }
    setOpen(true);
    onOpenChange?.(true);
    const timer = setTimeout(() => doSearch(trimmedQuery), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setWebLoading(true);
    setError(false);
    setHighlightedCreator(null);
    setKnowledgeCard(null);
    setAlternativeMatches([]);

    try {
      const likeQ = `%${q}%`;
      const likeQEscaped = escapePostgrestValue(likeQ);

      // Generate fuzzy variants (swap common letter pairs: i/y, z/s, etc.)
      const fuzzyVariants = new Set<string>([q]);
      const swaps: [string, string][] = [['i', 'y'], ['y', 'i'], ['z', 's'], ['s', 'z'], ['c', 'k'], ['k', 'c'], ['ph', 'f'], ['f', 'ph']];
      for (const [from, to] of swaps) {
        if (q.toLowerCase().includes(from)) {
          fuzzyVariants.add(q.toLowerCase().replace(new RegExp(from, 'gi'), to));
        }
      }

      const fuzzyFilters = Array.from(fuzzyVariants)
        .map(v => {
          const ev = escapePostgrestValue(`%${v}%`);
          return `full_name.ilike.${ev},role.ilike.${ev}`;
        })
        .join(',');

      // Fast DB queries for instant results
      const dbPromise = Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, role, bio, location, is_claimed")
          .or(fuzzyFilters)
          .or("onboarding_completed.eq.true,is_claimed.eq.false")
          .limit(8),
        supabase
          .from("credits")
          .select("id, project_name, role, year, project_type, thumbnail_url")
          .or(`project_name.ilike.${likeQEscaped},role.ilike.${likeQEscaped}`)
          .limit(5),
        supabase
          .from("opportunities")
          .select("id, title, type, compensation, location")
          .eq("status", "active")
          .ilike("title", likeQ)
          .limit(3),
      ]);

      // Universal search in parallel (includes web + AI knowledge card) with 20s timeout
      const universalPromise = Promise.race([
        supabase.functions.invoke("universal-search", { body: { query: q } }).catch(() => ({ data: null })),
        new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 20000)),
      ]);

      // Show DB results first (fast)
      const [profiles, credits, opps] = await dbPromise;
      if (controller.signal.aborted) return;

      const dbResults: SearchResult[] = [];

      for (const p of profiles.data || []) {
        dbResults.push({
          type: "creator",
          id: p.user_id,
          title: p.full_name || "Creator",
          subtitle: [p.role, p.location].filter(Boolean).join(" · "),
          avatar: p.avatar_url,
          bio: p.bio || undefined,
          is_claimed: p.is_claimed !== false,
        });
      }

      for (const c of credits.data || []) {
        dbResults.push({
          type: "credit",
          id: c.id,
          title: c.project_name,
          subtitle: [c.role, c.year].filter(Boolean).join(" · "),
          avatar: c.thumbnail_url,
        });
      }

      for (const o of opps.data || []) {
        dbResults.push({
          type: "gig",
          id: o.id,
          title: o.title,
          subtitle: [o.type, o.compensation, o.location].filter(Boolean).join(" · "),
        });
      }

      setResults(dbResults);
      setLoading(false);

      // Highlight first creator
      const firstCreator = dbResults.find((r) => r.type === "creator");
      if (firstCreator) {
        const { data: creatorCredits } = await supabase
          .from("credits")
          .select("project_name, role")
          .eq("user_id", firstCreator.id)
          .order("year", { ascending: false })
          .limit(4);

        if (!controller.signal.aborted) {
          firstCreator.credits = (creatorCredits || []).map((c) => ({
            project: c.project_name,
            role: c.role,
          }));
          setHighlightedCreator(firstCreator);
        }
      }

      // Now await universal search (web + AI)
      const universalResponse = await universalPromise;
      if (controller.signal.aborted) return;

      const uData = universalResponse?.data;

      if (uData) {
        // Extract knowledge card & alternatives
        if (uData.external?.knowledge_card) {
          setKnowledgeCard(uData.external.knowledge_card);
        }
        if (Array.isArray(uData.external?.alternative_matches) && uData.external.alternative_matches.length > 0) {
          setAlternativeMatches(uData.external.alternative_matches);
        }

        // Add web visual results
        const visualResults: SearchResult[] = (uData.external?.visual_results || []).slice(0, 6).map((r: any, i: number) => ({
          type: "web" as const,
          id: `web-${i}`,
          title: r.title,
          subtitle: [r.subtitle, r.year, r.platform].filter(Boolean).join(" · "),
          avatar: r.image_url || null,
          platform: r.platform,
          url: r.url,
        }));

        if (visualResults.length > 0) {
          setResults((prev) => [...prev, ...visualResults]);
        }
      }

      setWebLoading(false);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Search error:", err);
        setResults([]);
        setError(true);
        setLoading(false);
        setWebLoading(false);
      }
    }
  }, []);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setHighlightedCreator(null);
    setKnowledgeCard(null);
    setAlternativeMatches([]);
    onOpenChange?.(false);

    if (onSelect) {
      onSelect(r);
      return;
    }

    if (r.type === "creator") navigate(`/profile/${r.id}`);
    else if (r.type === "gig") navigate(`/opportunity/${r.id}`);
    else if (r.type === "credit") navigate(`/production?name=${encodeURIComponent(r.title)}`);
    else if (r.url) window.open(r.url, "_blank");
    else navigate(`/search?q=${encodeURIComponent(r.title)}`);
  };

  const submitQuery = useCallback((rawQuery: string) => {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) return;

    setOpen(false);
    onOpenChange?.(false);

    if (onQuerySubmit) {
      onQuerySubmit(trimmedQuery);
      return;
    }

    setQuery("");
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  }, [navigate, onOpenChange, onQuerySubmit, setQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(false);
    setHighlightedCreator(null);
    setKnowledgeCard(null);
    setAlternativeMatches([]);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        onOpenChange?.(false);
      } else if (query) {
        handleClear();
      }
      return;
    }
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
      e.preventDefault();
      const focusable = resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-search-result]");
      if (!focusable || focusable.length === 0) return;
      if (e.key === "ArrowDown") focusable[0].focus();
      else focusable[focusable.length - 1].focus();
    }
  };

  const handleResultKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      onOpenChange?.(false);
      suppressReopenRef.current = true;
      inputRef.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const focusable = Array.from(
      resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-search-result]") ?? [],
    );
    const currentIndex = focusable.indexOf(e.currentTarget);
    if (currentIndex === -1) return;
    const nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0) {
      inputRef.current?.focus();
    } else if (nextIndex < focusable.length) {
      focusable[nextIndex].focus();
    }
  };

  const isHero = variant === "hero";
  const isNavbar = variant === "navbar";

  const voice = useVoiceSearch({
    onTranscript: (text) => {
      setQuery(text);
      setOpen(true);
      onOpenChange?.(true);
      inputRef.current?.focus();
    },
  });

  // Transient permission/error messages clear themselves — they're a
  // toast-style note, not a persistent blocker; typed search keeps working
  // the whole time regardless of voice state.
  useEffect(() => {
    if (voice.status !== "denied" && voice.status !== "error") return;
    const t = setTimeout(voice.dismissError, 5000);
    return () => clearTimeout(t);
  }, [voice.status, voice.dismissError]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground",
              isHero ? "left-4 h-5 w-5" : "left-3 h-4 w-4"
            )}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              onOpenChange?.(true);
            }}
            onFocus={() => {
              if (suppressReopenRef.current) {
                suppressReopenRef.current = false;
                return;
              }
              if (query.trim().length >= 2) {
                setOpen(true);
                onOpenChange?.(true);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            role="combobox"
            aria-label="Search a name, project or opportunity"
            aria-expanded={open}
            aria-controls={listboxId}
            className={cn(
              "w-full border text-foreground transition-all placeholder:text-muted-foreground/50 focus:outline-none",
              isHero
                ? "h-12 sm:h-14 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm pl-12 pr-20 text-sm shadow-lg focus:border-primary focus:shadow-[var(--shadow-glow)]"
                : isNavbar
                ? "h-9 rounded-xl border-border bg-muted/40 pl-9 pr-8 text-sm focus:border-primary/50 focus:bg-card"
                : "h-10 rounded-xl border-border bg-muted/40 pl-9 pr-8 text-sm focus:border-primary/50 focus:bg-card"
            )}
          />
          {(voice.status === "recording" || voice.status === "processing") ? (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 right-1.5 flex items-center gap-1.5 rounded-full glass-surface pl-2.5 pr-1 py-1",
              )}
            >
              {voice.status === "recording" ? (
                <>
                  <VoiceWaveform level={voice.level} className="w-8" />
                  <button
                    type="button"
                    onClick={voice.stop}
                    aria-label="Stop and use this recording"
                    title="Stop"
                    className="h-6 w-6 shrink-0 rounded-full bg-[hsl(var(--color-accent))] text-white flex items-center justify-center hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]"
                  >
                    <Square className="h-2.5 w-2.5 fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={voice.cancel}
                    aria-label="Cancel recording"
                    title="Cancel"
                    className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Transcribing…
                </span>
              )}
            </div>
          ) : (
            <>
              {query ? (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors before:absolute before:-inset-2.5 before:content-['']",
                    isHero ? "right-14" : "right-8"
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : voice.supported ? (
                <button
                  type="button"
                  onClick={voice.start}
                  disabled={voice.status === "requesting"}
                  aria-label="Search by voice"
                  title="Search by voice"
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[hsl(var(--color-accent))] transition-colors disabled:opacity-50 before:absolute before:-inset-2.5 before:content-['']",
                    isHero ? "right-14" : "right-8"
                  )}
                >
                  {voice.status === "requesting" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
              <button
                type="submit"
                aria-label="Search"
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors",
                  isHero
                    ? "right-2.5 h-9 w-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : "right-1.5 h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/80"
                )}
              >
                {isHero ? <ArrowRight className="h-4 w-4" /> : <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>

        {/* Voice permission/error note — transient, self-dismissing, never
            blocks typed search which keeps working throughout. */}
        {(voice.status === "denied" || voice.status === "error") && voice.errorMessage && (
          <div
            role="status"
            className="mt-1.5 flex items-center justify-between gap-2 rounded-lg glass-surface px-2.5 py-1.5 text-[11px] text-muted-foreground"
          >
            <span>{voice.errorMessage}</span>
            <button
              type="button"
              onClick={voice.dismissError}
              aria-label="Dismiss"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </form>

      {/* ═══ DROPDOWN ═══ */}
      {open && query.trim().length >= 2 && (
        <div
          id={listboxId}
          role="region"
          aria-label="Search results"
          className={cn(
            // Solid bg-popover, not the translucent glass-surface-elevated
            // treatment used elsewhere in the app -- a search results list
            // sitting over the page's own content (hero backgrounds, other
            // cards) needs a genuinely opaque surface to stay readable,
            // same token every other dropdown/popover in this codebase
            // already uses (command.tsx, context-menu.tsx, hover-card.tsx).
            "absolute left-0 right-0 mt-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-[100] overflow-hidden",
            isNavbar ? "max-h-[70vh]" : "max-h-[60vh]"
          )}
        >
          <div ref={resultsRef} className="overflow-y-auto max-h-[inherit]">
            {/* Loading state — show when either loading or webLoading with no results yet */}
            {(loading || (webLoading && results.length === 0 && !knowledgeCard)) && (
              <div className="px-4 py-6 flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-primary/20 flex items-center justify-center">
                    <Search className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <Loader2 className="h-10 w-10 animate-spin text-primary/60 absolute inset-0" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Searching the creative universe</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {loading ? "Checking creators, credits, gigs & the web..." : "Scanning the web for matches..."}
                  </p>
                </div>
              </div>
            )}

            {/* ═══ KNOWLEDGE CARD (from AI) ═══ */}
            {knowledgeCard && !highlightedCreator && (
              <div className="border-b border-border bg-primary/[0.03]">
                <button
                  type="button"
                  data-search-result
                  onKeyDown={handleResultKeyDown}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    onOpenChange?.(false);
                    submitQuery(knowledgeCard.name);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {knowledgeCard.image_url ? (
                      <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
                        <AvatarImage src={knowledgeCard.image_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {(knowledgeCard.name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{knowledgeCard.name}</p>
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30 shrink-0">
                          {knowledgeCard.industry || knowledgeCard.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{knowledgeCard.description}</p>
                      {knowledgeCard.known_for && knowledgeCard.known_for.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {knowledgeCard.known_for.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/10">
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      {knowledgeCard.platforms && knowledgeCard.platforms.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Found on: {knowledgeCard.platforms.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {knowledgeCard.claim_prompt && (
                  <div className="px-4 pb-2 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/60">{knowledgeCard.claim_prompt}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(false);
                        setQuery("");
                        onOpenChange?.(false);
                        submitQuery(knowledgeCard.name);
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg bg-energy text-energy-foreground hover:brightness-110 shadow-glow-lime transition-all shrink-0"
                    >
                      <UserCheck className="h-3 w-3" />
                      Claim Profile
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Highlighted creator card (from DB) */}
            {highlightedCreator && (
              <div className="border-b border-border">
                <button
                  data-search-result
                  onKeyDown={handleResultKeyDown}
                  onClick={() => handleSelect(highlightedCreator)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
                      <AvatarImage src={highlightedCreator.avatar || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {(highlightedCreator.title || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">
                          {highlightedCreator.title}
                        </p>
                        {highlightedCreator.is_claimed === false ? (
                          <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10 shrink-0">
                            Unclaimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-primary border-primary/30 shrink-0">
                            Creator
                          </Badge>
                        )}
                      </div>
                      {highlightedCreator.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">{highlightedCreator.subtitle}</p>
                      )}
                      {highlightedCreator.bio && (
                        <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 italic">
                          "{highlightedCreator.bio}"
                        </p>
                      )}
                      {highlightedCreator.credits && highlightedCreator.credits.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {highlightedCreator.credits.slice(0, 3).map((c, i) => (
                            <span key={i} className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/10">
                              {c.project} — {c.role}
                            </span>
                          ))}
                          {highlightedCreator.credits.length > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1">
                              +{highlightedCreator.credits.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                <div className="px-4 pb-2 space-y-1.5">
                  {highlightedCreator.is_claimed === false && (
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground/60">
                        Is this you? Verify your identity to claim.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          setQuery("");
                          onOpenChange?.(false);
                          navigate(`/profile/${highlightedCreator.id}?showClaim=true`);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg bg-energy text-energy-foreground hover:brightness-110 shadow-glow-lime transition-all shrink-0"
                      >
                        <UserCheck className="h-3 w-3" />
                        Claim Profile
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/60">
                    Not who you're looking for?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setHighlightedCreator(null);
                        inputRef.current?.focus();
                      }}
                      className="text-primary/70 hover:text-primary underline underline-offset-2"
                    >
                      See all results
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ═══ ALTERNATIVE MATCHES from AI ═══ */}
            {alternativeMatches.length > 0 && (
              <div className="border-b border-border">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {highlightedCreator || knowledgeCard ? "Other people with this name" : "People found on the web"}
                </p>
                {alternativeMatches.slice(0, 4).map((alt, i) => (
                  <button
                    key={`alt-match-${i}`}
                    data-search-result
                    onKeyDown={handleResultKeyDown}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      onOpenChange?.(false);
                      submitQuery(alt.name);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors text-left"
                  >
                    {alt.image_url ? (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={alt.image_url} />
                        <AvatarFallback className="text-xs bg-accent/10 text-accent">
                          {(alt.name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{alt.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[alt.industry, alt.location].filter(Boolean).join(" · ") || alt.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-accent border-accent/30 shrink-0">
                      Web
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {/* Other DB creator matches */}
            {highlightedCreator && (() => {
              const otherCreators = results.filter(
                (r) => r.type === "creator" && r.id !== highlightedCreator.id
              );
              if (otherCreators.length === 0) return null;
              return (
                <div className="border-b border-border">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Other potential matches
                  </p>
                  {otherCreators.slice(0, 3).map((r, i) => (
                    <button
                      key={`alt-${r.id}-${i}`}
                      data-search-result
                      onKeyDown={handleResultKeyDown}
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors text-left"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={r.avatar || ""} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(r.title || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                        )}
                      </div>
                      {r.is_claimed === false ? (
                        <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10 shrink-0">
                          Unclaimed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30 shrink-0">
                          Creator
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Rest of results — grouped under labeled headers (Creative
                Records / Opportunities / Discovered) rather than one mixed
                list, so it reads as an AI-organized answer, not a grep dump. */}
            {(["creator", "credit", "gig", "web"] as const).map((groupType) => {
              const items = results.filter((r) => {
                if (r.type !== groupType) return false;
                if (!highlightedCreator) return true;
                // Creator-type results are already covered by the
                // highlighted-creator card and "Other potential matches"
                // above once a highlightedCreator exists — avoid duplicates.
                return r.id !== highlightedCreator.id && r.type !== "creator";
              });
              if (items.length === 0) return null;
              return (
                <div key={groupType} className="border-b border-border last:border-b-0">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {RESULT_GROUP_LABEL[groupType]}
                  </p>
                  {items.map((r, i) => {
                    const meta = TYPE_META[r.type];
                    return (
                      <button
                        key={`${r.type}-${r.id}-${i}`}
                        data-search-result
                        onKeyDown={handleResultKeyDown}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors text-left"
                      >
                        {r.avatar ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={r.avatar} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(r.title || "?")[0]}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <meta.icon className={cn("h-3.5 w-3.5", meta.color)} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p>
                          )}
                        </div>
                        {r.type === "web" && r.url ? (
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        ) : r.type === "creator" && r.is_claimed === false ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10">
                              Unclaimed
                            </Badge>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                setQuery("");
                                onOpenChange?.(false);
                                navigate(`/profile/${r.id}?showClaim=true`);
                              }}
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-[hsl(var(--color-accent))] text-white"
                            >
                              <UserCheck className="h-2.5 w-2.5" />
                              Claim
                            </button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] shrink-0", meta.color)}
                          >
                            {meta.label}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Background web search indicator */}
            {webLoading && results.length > 0 && (
              <div className="px-4 py-2 flex items-center justify-center gap-2 text-xs text-muted-foreground/60 border-t border-border/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Checking the web for more matches...</span>
              </div>
            )}

            {/* Error state — distinct from "no results" so a failed search
                isn't mistaken for a genuinely empty result set. */}
            {!loading && !webLoading && error && (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-destructive">Search failed</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Something went wrong reaching search — check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => doSearch(query.trim())}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--color-accent))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))] rounded"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !webLoading && !error && results.length === 0 && !knowledgeCard && query.trim().length >= 2 && (
              <div className="px-4 py-4 text-center">
                <Sparkles className="h-5 w-5 text-primary/50 mx-auto mb-1.5" />
                <p className="text-sm text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Try a different name or project
                </p>
              </div>
            )}

            {/* Deep search footer */}
            {(results.length > 0 || knowledgeCard) && (
              <button
                type="button"
                data-search-result
                onKeyDown={handleResultKeyDown}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submitQuery(query)}
                className="w-full px-4 py-2.5 text-sm text-primary font-medium hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors border-t border-border flex items-center justify-center gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Deep search for "{query}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
