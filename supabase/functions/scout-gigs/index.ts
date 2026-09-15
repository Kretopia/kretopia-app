// Smart Gig Scout — finds REAL external gigs across web, gig boards, ATS,
// LinkedIn public job pages, and Instagram casting hashtags.
// Triggered manually from /gigs ("Scan now") or via daily cron.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2/search";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Profile {
  user_id: string;
  full_name: string | null;
  role: string | null;
  sub_roles: string[] | null;
  skills: string[] | null;
  location: string | null;
  bio: string | null;
}

interface ScoutPrefs {
  sources: string[];
  extra_keywords: string[] | null;
  exclude_keywords: string[] | null;
  remote_only: boolean;
  min_fit_score: number;
  job_types: string[] | null;
  employment_types: string[] | null;
  locations: string[] | null;
  travel_ok: boolean;
  instructions: string | null;
}

// Curated, scrapable, English-speaking creative gig sources
const WEB_SITES = [
  "mandy.com", "backstage.com", "productionhub.com", "stage32.com",
  "soundbetter.com", "workingnotworking.com", "contra.com",
  "weworkremotely.com", "mediabistro.com", "coroflot.com",
  "dribbble.com/jobs", "behance.net/joblist", "authenticjobs.com",
  "remoteok.com", "freelancer.com", "upwork.com", "peopleperhour.com",
  "twine.net", "thedots.co", "krop.com", "talenthouse.com",
  "wellfound.com", "ycombinator.com/jobs", "remote.co", "justremote.co",
  "weworkremotely.com/categories/remote-design-jobs",
  "creativepool.com", "if-you-could.co.uk", "designjobsboard.com",
  "freelancermap.com", "wellfound.com/jobs",
];

const ATS_SITES = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com",
  "jobs.smartrecruiters.com", "myworkdayjobs.com", "bamboohr.com/jobs",
  "recruitee.com", "teamtailor.com", "jobvite.com",
];

const FB_QUERIES = [
  "facebook.com/groups creative gigs",
  "facebook.com/groups freelance",
];

function buildSearchQueries(p: Profile, prefs: ScoutPrefs): { source: string; query: string }[] {
  const role = p.role || "creative";
  const subs = (p.sub_roles || []).slice(0, 2);
  const skills = (p.skills || []).slice(0, 4);
  const jobTypes = (prefs.job_types || []).slice(0, 3);
  const empTypes = (prefs.employment_types || []).slice(0, 2);
  // Locations: user-tuned list wins, else profile location, else "remote"
  const userLocs = (prefs.locations || []).filter(Boolean);
  const locList = prefs.remote_only ? ["remote"] : (userLocs.length ? userLocs : [p.location || "remote"]);
  const extra = (prefs.extra_keywords || []).slice(0, 3).join(" ");
  const empSuffix = empTypes.length ? ` ${empTypes.join(" OR ")}` : "";

  const baseRole = [jobTypes[0] || role, ...subs, ...skills.slice(0, 2), extra].filter(Boolean).join(" ").trim();
  const queries: { source: string; query: string }[] = [];

  // Fan out across each preferred location (cap to 3 to keep request count sane)
  for (const loc of locList.slice(0, 3)) {
    const baseTerms = `${baseRole}${empSuffix} ${loc}`.trim();

    if (prefs.sources.includes("web")) {
      for (const site of WEB_SITES.slice(0, 6)) {
        queries.push({ source: "web", query: `site:${site} ${baseTerms}` });
      }
    }
    if (prefs.sources.includes("ats")) {
      for (const site of ATS_SITES) {
        queries.push({ source: "ats", query: `site:${site} ${jobTypes[0] || role} ${skills[0] || ""} ${loc}`.trim() });
      }
    }
    if (prefs.sources.includes("linkedin")) {
      queries.push({ source: "linkedin", query: `site:linkedin.com/jobs "${jobTypes[0] || skills[0] || role}" ${loc}` });
    }
    if (prefs.sources.includes("instagram")) {
      queries.push({ source: "instagram", query: `site:instagram.com/explore/tags casting ${jobTypes[0] || role} ${loc}` });
      queries.push({ source: "instagram", query: `site:instagram.com "open call" ${jobTypes[0] || role} ${loc}` });
    }
    if (prefs.sources.includes("facebook")) {
      for (const q of FB_QUERIES) {
        queries.push({ source: "web", query: `site:${q} ${jobTypes[0] || role} ${loc}` });
      }
    }
  }
  return queries;
}

// Per-source timeout: one dead/slow query must not stall the whole scan.
// Firecrawl calls that exceed this are aborted and treated as "no results"
// for that source, not a fatal error for the run.
const SOURCE_TIMEOUT_MS = 9000;

async function firecrawlSearch(query: string, key: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(FIRECRAWL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: 6,
        // RECENCY: only results from the past WEEK (was past month)
        tbs: "qdr:w",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.warn("[scout] firecrawl", timedOut ? "timeout" : "network error", query);
    return [];
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    console.warn("[scout] firecrawl fail", query, r.status);
    return [];
  }
  const j = await r.json();
  const arr = Array.isArray(j.data) ? j.data
    : Array.isArray(j.data?.web) ? j.data.web
    : Array.isArray(j.web) ? j.web
    : [];
  return arr.map((it: any) => {
    const meta = it.metadata || {};
    const md = it.markdown || "";
    const mdImg = md.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|gif))/i);
    return {
      url: it.url,
      title: it.title,
      markdown: md,
      description: it.description,
      image_url: meta.ogImage || meta["og:image"] || meta.image || meta.twitterImage || (mdImg ? mdImg[1] : null),
    };
  }) as Array<{ url: string; title?: string; markdown?: string; description?: string; image_url?: string | null }>;
}

async function extractAndScore(
  raw: Array<{ url: string; title?: string; markdown?: string; description?: string; source: string }>,
  profile: Profile,
  prefs: ScoutPrefs,
  lovableKey: string,
) {
  if (raw.length === 0) return [];
  const snippets = raw
    .slice(0, 30)
    .map((r, i) =>
      `[${i + 1}] SOURCE:${r.source}\nURL:${r.url}\nTITLE:${r.title || ""}\nCONTENT:${(r.markdown || r.description || "").slice(0, 1200)}`,
    )
    .join("\n\n---\n\n");

  const prefBlurb = [
    prefs.job_types?.length ? `Wants roles: ${prefs.job_types.join(", ")}` : "",
    prefs.employment_types?.length ? `Employment: ${prefs.employment_types.join(", ")}` : "",
    prefs.locations?.length ? `Preferred locations: ${prefs.locations.join(", ")}` : "",
    prefs.remote_only ? "Remote only: YES" : "",
    prefs.travel_ok ? "Open to travel: YES" : "Open to travel: NO",
    prefs.exclude_keywords?.length ? `Exclude: ${prefs.exclude_keywords.join(", ")}` : "",
    prefs.instructions ? `User notes: ${prefs.instructions.slice(0, 600)}` : "",
  ].filter(Boolean).join("\n");

  const profileBlurb = `Role: ${profile.role || "creative"}
Sub-roles: ${(profile.sub_roles || []).join(", ")}
Skills: ${(profile.skills || []).join(", ")}
Location: ${profile.location || "remote"}
Bio: ${(profile.bio || "").slice(0, 300)}
${prefBlurb ? `\nUSER SCOUT PREFERENCES:\n${prefBlurb}` : ""}`;

  const aiController = new AbortController();
  const aiTimer = setTimeout(() => aiController.abort(), 25000);
  let r: Response;
  try {
    r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    signal: aiController.signal,
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You extract REAL, RECENTLY POSTED paid creative gigs from search results. STRICT RULES: (1) REJECT anything older than 14 days — if snippet says '3 weeks ago', '1 month ago', '6 months ago', 'no longer accepting', 'expired', 'closed', 'filled', REJECT. (2) REJECT generic listing/search/category pages, articles, blog posts, 'top 10' roundups. The URL MUST be a deep-link to ONE specific job/casting/gig posting (e.g. .../jobs/12345, .../p/AbC123, .../job-title-slug-id). REJECT URLs that end in /jobs, /jobs/, /careers, /search, /browse, /explore, /tags, /listings, /opportunities, or are just a domain homepage. (3) REJECT entries where you cannot extract a real role title AND at least one concrete detail (description, compensation, or company). Do NOT invent details. (4) BALANCE SOURCES — do not return more than 3 LinkedIn results total; prioritize gig boards, ATS, Instagram open calls, and indie creative platforms. (5) HONOR USER SCOUT PREFERENCES strictly — if user lists preferred job_types/employment_types, only return matching roles; if user lists preferred locations, only return gigs in those cities OR remote (unless travel_ok=YES); if remote_only=YES, only return remote gigs; respect 'Exclude' keywords and 'User notes' as hard filters. (6) Score fit 0-100 against the creator profile + preferences (boost when role/location/employment match). (7) ELIGIBILITY GATE — REJECT entirely any opportunity that restricts applicants by demographic (gender, age bracket, ethnicity, nationality, country/region of residence, religion, disability status, student status, alumni-only, members-only) UNLESS the creator profile clearly matches the restriction. Examples to REJECT for a generic profile: 'for women only', 'young women entrepreneurs', 'Black creators only', 'Africa-based founders', 'under 25', 'students only', 'US citizens only', 'EU residents only'. Do NOT include these as low-score gigs — drop them completely. When in doubt about eligibility, REJECT.",
        },
        {
          role: "user",
          content: `TODAY: ${new Date().toISOString().slice(0,10)}\n\nCREATOR PROFILE:\n${profileBlurb}\n\nSEARCH RESULTS:\n${snippets}\n\nExtract ONLY active gigs posted in the LAST 14 DAYS that link to a SPECIFIC posting page (not a category/search). Cap LinkedIn at 3 max. For each: title, company, location, remote, description (2-4 sentences with REAL details from the snippet — never blank, never "see post"), compensation, contact_email, apply_url (MUST be the deep-link to the specific posting), posted_age (REQUIRED), skills, fit_score, fit_reason, source.`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_gigs",
          description: "Save extracted real gigs",
          parameters: {
            type: "object",
            properties: {
              gigs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    company: { type: "string" },
                    location: { type: "string" },
                    remote: { type: "boolean" },
                    description: { type: "string" },
                    compensation: { type: "string" },
                    contact_email: { type: "string" },
                    apply_url: { type: "string" },
                    source_url: { type: "string" },
                    source: { type: "string", enum: ["web","linkedin","instagram","ats","gigboard"] },
                    source_name: { type: "string" },
                    skills: { type: "array", items: { type: "string" } },
                    fit_score: { type: "number" },
                    fit_reason: { type: "string" },
                    posted_age: { type: "string", description: "e.g. '2 days ago', '3 weeks ago'" },
                  },
                  required: ["title","source_url","source","fit_score","fit_reason","posted_age"],
                },
              },
            },
            required: ["gigs"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_gigs" } },
    }),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.error("[scout] AI", timedOut ? "timeout" : "network error", e);
    return [];
  } finally {
    clearTimeout(aiTimer);
  }
  if (!r.ok) {
    console.error("[scout] AI fail", r.status, await r.text());
    return [];
  }
  const j = await r.json();
  try {
    const args = JSON.parse(j.choices[0].message.tool_calls[0].function.arguments);
    return (args.gigs || []) as any[];
  } catch (e) {
    console.error("[scout] parse fail", e);
    return [];
  }
}

function dedupeKey(g: { source_url: string; title: string }) {
  // Strip query/hash from URL + lowercase title
  const url = (g.source_url || "").split("?")[0].split("#")[0].toLowerCase();
  const title = (g.title || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  return `${url}::${title}`;
}

// True if URL looks like a generic listing/search/category page rather than a
// deep-link to ONE specific gig posting.
function isGenericListingUrl(u: string): boolean {
  if (!u) return true;
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    if (!path) return true;
    const segs = path.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    const generic = new Set([
      "jobs","job","careers","career","search","browse","explore","listings",
      "opportunities","gigs","work","hiring","tags","tag","category","categories",
      "feed","home","casting","castings","openings","positions","postings","apply",
    ]);
    if (generic.has(last)) return true;
    // Bare category page like /jobs/design with no specific posting id/slug
    if (segs.length < 2 && last.length < 8) return true;
    // Search-like URLs with only a query
    if (url.search && /[?&](q|query|keyword|search)=/.test(url.search) && segs.length <= 2) return true;
    // LinkedIn jobs needs /view/<id> to be a specific posting
    if (/linkedin\.com$/.test(url.hostname) || /linkedin\.com$/.test(url.hostname.replace(/^www\./, ""))) {
      if (!/\/jobs\/view\//.test(path)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  const aiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!fcKey || !aiKey) {
    return new Response(JSON.stringify({ error: "Scout not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let userId: string | null = null;
  let trigger = "manual";
  try {
    const body = await req.json().catch(() => ({}));
    trigger = body.trigger || "manual";

    // Resolve user from JWT (manual) or body (cron)
    if (body.user_id) {
      userId = body.user_id;
    } else {
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = await checkAiFeatureRateLimit(supabase, userId, "scout-gigs");
    if (!rateLimit.allowed) return rateLimit.response;

    const [{ data: profile }, { data: prefsRow }] = await Promise.all([
      supabase.from("profiles")
        .select("user_id, full_name, role, sub_roles, professional_skills, passion_skills, location, bio, subscription_tier")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("scout_preferences").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    // Tier gating: free=1 preview/week, creator=daily full, creator_pro=priority+unlimited, founder=unlimited
    const tier = ((profile as any)?.subscription_tier || "free").toLowerCase();
    const isFree = tier === "free" || tier === "spark" || tier === "";
    const isPro = tier === "creator_pro" || tier === "founder" || tier === "brand_enterprise";
    let perRunCap = isFree ? 1 : (tier === "creator" ? 10 : 25);
    if (isFree) {
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { count } = await supabase
        .from("scouted_gigs")
        .select("id", { count: "exact", head: true })
        .eq("target_user_id", userId)
        .gte("scouted_at", weekAgo);
      if ((count ?? 0) >= 1) {
        return new Response(JSON.stringify({
          ok: true, gated: true, tier, message: "Free tier: 1 Scout preview per week. Upgrade to Creator for daily Scout + auto-drafted applications.",
          found: 0, inserted: 0,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mergedProfile: Profile = {
      user_id: (profile as any).user_id,
      full_name: (profile as any).full_name,
      role: (profile as any).role,
      sub_roles: (profile as any).sub_roles,
      skills: [
        ...((profile as any).professional_skills || []),
        ...((profile as any).passion_skills || []),
      ],
      location: (profile as any).location,
      bio: (profile as any).bio,
    };

    // Auto-create prefs if missing
    let prefs: ScoutPrefs = prefsRow ?? {
      sources: ["web", "linkedin", "instagram", "ats"],
      extra_keywords: null, exclude_keywords: null, remote_only: false, min_fit_score: 60,
      job_types: null, employment_types: null, locations: null, travel_ok: false, instructions: null,
    } as ScoutPrefs;
    if (!prefsRow) {
      await supabase.from("scout_preferences").insert({ user_id: userId });
    }

    const queries = buildSearchQueries(mergedProfile, prefs);
    console.log("[scout] queries", queries.length, "for", userId);

    // Run searches concurrently in wider batches than before -- each
    // individual call is now time-bounded (SOURCE_TIMEOUT_MS), so a dead
    // source can no longer stall the whole scan the way an un-timed-out
    // sequential chunk could. allSettled means one rejected promise never
    // takes down its batch's other results.
    const allRaw: any[] = [];
    const CHUNK = 12;
    for (let i = 0; i < queries.length; i += CHUNK) {
      const batch = queries.slice(i, i + CHUNK);
      const results = await Promise.allSettled(batch.map(async (q) => {
        const items = await firecrawlSearch(q.query, fcKey);
        return items.map((it) => ({ ...it, source: q.source }));
      }));
      for (const r of results) {
        if (r.status === "fulfilled") allRaw.push(...r.value);
      }
    }
    console.log("[scout] raw results", allRaw.length);

    const extracted = await extractAndScore(allRaw, mergedProfile, prefs, aiKey);
    // Reject anything older than 30 days based on AI-extracted posted_age
    const isStale = (age: string) => {
      if (!age) return true;
      const a = age.toLowerCase();
      if (/year|yr|month/.test(a)) return true;
      if (/no longer|expired|closed|filled/.test(a)) return true;
      // weeks: only allow "1 week" or "this week"
      const wk = a.match(/(\d+)\s*week/);
      if (wk && parseInt(wk[1], 10) > 2) return true;
      return false;
    };
    // Cap LinkedIn to 3 max in the final output
    const linkedinCap = { count: 0, max: 3 };
    const filtered = extracted.filter((g: any) => {
      if (!g.title || !g.source_url) return false;
      if ((g.fit_score ?? 0) < prefs.min_fit_score) {
        // Logged (not silent, unlike before) so a thin/empty-profile scan's
        // actual scores are visible in function logs without guessing --
        // same visibility the demographic/region drops below already had.
        console.log("[scout] dropped low fit_score:", g.fit_score, "<", prefs.min_fit_score, "-", g.title);
        return false;
      }
      if (isStale(g.posted_age || "")) return false;
      // URL must be a deep-link to a specific posting (not a search/category page)
      const apply = g.apply_url || g.source_url;
      if (isGenericListingUrl(apply) && isGenericListingUrl(g.source_url)) return false;
      // Require a real description so cards aren't empty shells
      const desc = (g.description || "").trim();
      if (desc.length < 40 && !g.compensation && !g.company) return false;
      const blob = `${g.title} ${desc} ${g.posted_age || ""}`.toLowerCase();
      if (/no longer accepting|expired|position closed|1 year ago|2 years ago|months ago/.test(blob)) return false;
      // Demographic eligibility guardrail — drop restricted opps unless profile clearly matches
      const profBlob = `${profile.bio || ""} ${(profile.sub_roles || []).join(" ")} ${profile.role || ""} ${profile.location || ""}`.toLowerCase();
      const restrictions: Array<[RegExp, RegExp]> = [
        [/\b(women|female)[- ]only|for women\b|young women|women entrepreneurs?|women in tech|she\/her only/i, /\b(she\/her|woman|female)\b/i],
        [/\b(men|male)[- ]only|for men\b/i, /\b(he\/him|man|male)\b/i],
        [/\bblack[- ](creators?|founders?|artists?|women|men)\b|black-only|for black\b/i, /\bblack\b/i],
        [/\blatin[ax][- ]/i, /\blatin[ax]\b/i],
        [/\bindigenous[- ]/i, /\bindigenous\b/i],
        [/\bstudents? only|current students?\b/i, /\bstudent\b/i],
        [/\balumni only\b/i, /\balumni\b/i],
        [/\bunder[- ]?(18|21|25|30)\b|youth only/i, /\b(youth|under)\b/i],
      ];
      for (const [needle, profMatch] of restrictions) {
        if (needle.test(blob) && !profMatch.test(profBlob)) {
          console.log("[scout] dropped demographic-restricted:", g.title);
          return false;
        }
      }
      // Region restrictions — drop if gig restricts to a region not in user's location
      const regionRestrict = blob.match(/\b(?:based in|residents? of|citizens? of|located in|from)\s+(africa|asia|europe|usa|united states|canada|uk|india|nigeria|kenya|south africa|brazil|mexico)\b/);
      if (regionRestrict && !profBlob.includes(regionRestrict[1].toLowerCase())) {
        console.log("[scout] dropped region-restricted:", g.title);
        return false;
      }
      if ((prefs.exclude_keywords || []).some((kw) => kw && blob.includes(kw.toLowerCase()))) return false;
      if (g.source === "linkedin") {
        if (linkedinCap.count >= linkedinCap.max) return false;
        linkedinCap.count++;
      }
      return true;
    });
    console.log("[scout] after recency+source filter", filtered.length, "of", extracted.length);
    // Profile-richness signal alongside the score distribution -- lets a
    // thin/empty-profile scan (new signup: default "creative" role, no
    // skills, no bio) be correlated against its actual fit_scores in logs,
    // to confirm or rule out a systematic low-score bias before changing
    // any scoring/threshold behavior.
    if (extracted.length > 0) {
      const scores = extracted.map((g: any) => g.fit_score ?? 0);
      const profileRichness =
        (mergedProfile.role ? 1 : 0) +
        (mergedProfile.sub_roles?.length ? 1 : 0) +
        (mergedProfile.skills?.length ? 1 : 0) +
        (mergedProfile.bio?.trim() ? 1 : 0);
      console.log(
        "[scout] fit_score distribution", JSON.stringify({
          userId, profileRichness, minScore: Math.min(...scores),
          maxScore: Math.max(...scores),
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          belowThreshold: scores.filter((s) => s < prefs.min_fit_score).length,
          total: scores.length,
        }),
      );
    }

    let inserted = 0;
    // Build url -> image map from raw search results to enrich gigs
    const imgByUrl = new Map<string, string>();
    for (const r of allRaw) {
      if (r?.url && r?.image_url) imgByUrl.set(r.url, r.image_url);
    }
    for (const g of filtered.slice(0, perRunCap)) {
      const key = dedupeKey(g);
      const image_url = imgByUrl.get(g.source_url) || null;
      const { error } = await supabase.from("scouted_gigs").upsert({
        target_user_id: userId,
        source: g.source,
        source_name: g.source_name || g.source,
        source_url: g.source_url,
        title: g.title.slice(0, 200),
        company: g.company || null,
        location: g.location || null,
        remote: !!g.remote,
        description: g.description || null,
        compensation: g.compensation || null,
        contact_email: g.contact_email || null,
        apply_url: !isGenericListingUrl(g.apply_url || "") ? g.apply_url : (!isGenericListingUrl(g.source_url) ? g.source_url : (g.apply_url || g.source_url)),
        skills: g.skills || null,
        fit_score: Math.round(g.fit_score),
        fit_reason: g.fit_reason || null,
        image_url,
        dedupe_key: key,
        raw: g,
      }, { onConflict: "target_user_id,dedupe_key", ignoreDuplicates: false });
      if (!error) inserted++;
      else console.warn("[scout] upsert fail", error.message);
    }

    await supabase.from("scout_runs").insert({
      user_id: userId, trigger, sources: prefs.sources,
      found_count: extracted.length, inserted_count: inserted,
      duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
    });
    await supabase.from("scout_preferences")
      .update({ last_run_at: new Date().toISOString() })
      .eq("user_id", userId);

    return new Response(JSON.stringify({
      ok: true, found: extracted.length, filtered: filtered.length, inserted, queries: queries.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[scout] error", e);
    if (userId) {
      await supabase.from("scout_runs").insert({
        user_id: userId, trigger, error: String(e),
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
