import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CREATOR_PLATFORM_PATTERNS = [
  /open\.spotify\.com\/artist/i,
  /spotify\.com\/artist/i,
  /music\.apple\.com\/.*\/artist/i,
  /soundcloud\.com\/[^/]+\/?$/i,
  /bandcamp\.com/i,
  /audiomack\.com\/[^/]+/i,
  /deezer\.com\/.*artist/i,
  /tidal\.com\/.*artist/i,
  /genius\.com\/artists\//i,
  /allmusic\.com\/artist/i,
  /discogs\.com\/artist/i,
  /musicbrainz\.org\/artist/i,
  /imdb\.com\/name\//i,
  /letterboxd\.com\/[^/]+/i,
  /themoviedb\.org\/person/i,
  /vimeo\.com\/[^/]+\/?$/i,
  /backstage\.com\/[^/]+/i,
  /behance\.net\/[^/]+/i,
  /dribbble\.com\/[^/]+/i,
  /artstation\.com\/[^/]+/i,
  /deviantart\.com\/[^/]+/i,
  /500px\.com\/[^/]+/i,
  /flickr\.com\/(photos|people)\/[^/]+/i,
  /models\.com\//i,
  /fashionunited\./i,
  /wwd\.com/i,
  /instagram\.com\/[^/]+\/?$/i,
  /tiktok\.com\/@/i,
  /youtube\.com\/(?:@|channel\/|c\/|user\/)/i,
  /twitter\.com\/[^/]+\/?$/i,
  /x\.com\/[^/]+\/?$/i,
  /linkedin\.com\/in\//i,
  /threads\.net\/@/i,
  /pinterest\.com\/[^/]+/i,
  /facebook\.com\/[^/]+\/?$/i,
  /twitch\.tv\/[^/]+/i,
  /kick\.com\/[^/]+/i,
  /medium\.com\/@?[^/]+/i,
  /substack\.com/i,
  /wattpad\.com\/user\//i,
  /goodreads\.com\/author/i,
  /podcasts\.apple\.com/i,
  /podchaser\.com\/creators/i,
  /eventbrite\.com\/o\//i,
  /songkick\.com\/artists/i,
  /bandsintown\.com\/[^/]+/i,
  /ra\.co\/dj\//i,
  /fiverr\.com\/[^/]+/i,
  /upwork\.com\/freelancers/i,
  /muso\.ai/i,
  /famousbirthdays\.com/i,
  /wikidata\.org/i,
];

const HIGH_PRIORITY_PLATFORM_PATTERNS = [
  /open\.spotify\.com\/artist/i,
  /music\.apple\.com\/.*\/artist/i,
  /soundcloud\.com\/[^/]+\/?$/i,
  /imdb\.com\/name\//i,
  /youtube\.com\/(?:@|channel\/|c\/|user\/)/i,
  /instagram\.com\/[^/]+\/?$/i,
  /behance\.net\/[^/]+/i,
  /dribbble\.com\/[^/]+/i,
  /muso\.ai/i,
];

type FirecrawlResult = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
  metadata?: Record<string, any>;
};

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeCreatorQuery(query: string) {
  const trimmed = query.trim();
  if (isUrl(trimmed)) return false;

  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
  const handleLike = /^[A-Za-z0-9._@-]{2,40}$/.test(trimmed);
  const personNameLike = /^[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,3}$/.test(trimmed);
  const projectKeyword = /\b(film|movie|song|album|ep|festival|event|show|campaign|documentary|podcast|series|tour|runway|editorial|production)\b/i.test(trimmed);

  return handleLike || personNameLike || (!projectKeyword && tokenCount <= 3);
}

function extractImageUrl(result: FirecrawlResult): string | null {
  const metadata = result?.metadata || {};
  const ogImage = metadata?.og?.image || metadata?.ogImage || metadata?.image || metadata?.twitter?.image;
  if (typeof ogImage === 'string' && ogImage.startsWith('http')) {
    return ogImage;
  }

  const markdown = result?.markdown || '';
  const match = markdown.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  return match?.[1] || null;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\((.*?)\)/g, ' ')
    .replace(/\[[^\]]*\]\((.*?)\)/g, ' ')
    .replace(/[>#*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value: string, max = 700) {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}…`;
}

function extractPageExcerpt(markdown: string | undefined) {
  if (!markdown) return '';
  const cleaned = stripMarkdown(markdown);
  return truncateText(cleaned, 900);
}

function isCreatorPlatformUrl(url: string) {
  return CREATOR_PLATFORM_PATTERNS.some((pattern) => pattern.test(url));
}

function isHighPriorityPlatformUrl(url: string) {
  return HIGH_PRIORITY_PLATFORM_PATTERNS.some((pattern) => pattern.test(url));
}

function isLikelyProfileUrl(url: string) {
  const lower = url.toLowerCase();
  if (!isCreatorPlatformUrl(lower)) return false;
  if (/(\/video\/|\/reel\/|\/p\/|watch\?|\/status\/|\/posts\/)/i.test(lower)) return false;
  return true;
}

function detectPlatformFromUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes('spotify.com')) return 'Spotify';
  if (lower.includes('music.apple.com')) return 'Apple Music';
  if (lower.includes('soundcloud.com')) return 'SoundCloud';
  if (lower.includes('bandcamp.com')) return 'Bandcamp';
  if (lower.includes('audiomack.com')) return 'Audiomack';
  if (lower.includes('youtube.com')) return 'YouTube';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('imdb.com')) return 'IMDb';
  if (lower.includes('behance.net')) return 'Behance';
  if (lower.includes('dribbble.com')) return 'Dribbble';
  if (lower.includes('muso.ai')) return 'Muso';
  if (lower.includes('linkedin.com')) return 'LinkedIn';
  if (lower.includes('vimeo.com')) return 'Vimeo';
  if (lower.includes('eventbrite.com')) return 'Eventbrite';
  return null;
}

function scoreSearchCandidate(result: FirecrawlResult, query: string, creatorQuery: boolean) {
  const q = normalizeText(query);
  const title = normalizeText(result?.title);
  const description = normalizeText(result?.description);
  const url = (result?.url || '').toLowerCase();

  let score = 0;

  if (title === q) score += 140;
  else if (title.startsWith(q)) score += 90;
  else if (title.includes(q)) score += 60;

  if (description.includes(q)) score += 18;
  if (url.includes(q.replace(/\s+/g, ''))) score += 35;
  if (isHighPriorityPlatformUrl(url)) score += 70;
  else if (isCreatorPlatformUrl(url)) score += 35;
  if (isLikelyProfileUrl(url)) score += 35;
  if (/(producer|artist|musician|creator|designer|director|filmmaker|model|photographer|podcaster|dj)/i.test(result?.description || '')) score += 18;
  if (/(monthly listeners|followers|subscribers|credits|official)/i.test(result?.description || '')) score += 15;
  if (result?.title && /topic|playlist|track|song/i.test(result.title)) score -= 10;

  if (!creatorQuery && isCreatorPlatformUrl(url)) score -= 10;

  return score;
}

function scoreResult(result: any, query: string, creatorQuery: boolean) {
  const q = normalizeText(query);
  const title = normalizeText(result?.title);
  const description = normalizeText(result?.description);
  const url = (result?.url || '').toLowerCase();
  const platform = normalizeText(result?.platform);

  let score = 0;
  if (title === q) score += 120;
  else if (title.includes(q)) score += 60;
  if (description.includes(q)) score += 15;
  if (url.includes(q.replace(/\s+/g, ''))) score += 30;
  if (result?.image_url) score += 10;

  if (creatorQuery) {
    if (isHighPriorityPlatformUrl(url)) score += 50;
    else if (isCreatorPlatformUrl(url)) score += 35;
    if (/(profile|channel|creator|artist|official|bio|portfolio)/i.test(`${description} ${url}`)) score += 20;
    if (/(monthly listeners|followers|subscribers|credits)/i.test(description)) score += 18;
    if (/(single|album|ep|track)/i.test(platform + ' ' + normalizeText(result?.type))) score -= 5;
  }

  return score;
}

function generateFuzzyVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  const lower = name.toLowerCase();
  const swaps: [string, string][] = [['i', 'y'], ['y', 'i'], ['z', 's'], ['s', 'z'], ['c', 'k'], ['k', 'c']];
  for (const [from, to] of swaps) {
    if (lower.includes(from)) {
      variants.add(name.replace(new RegExp(from, 'gi'), to));
    }
  }
  return Array.from(variants);
}

function buildSearchQueries(name: string, isCreator: boolean) {
  const variants = generateFuzzyVariants(name);
  const exact = `"${name}"`;
  const allExacts = variants.map(v => `"${v}"`).join(' OR ');

  if (!isCreator) {
    return [
      `${exact} credits production album film project`,
      `${exact} creative portfolio event`,
      `${exact} review press interview`,
      `${exact} official website`,
      `${exact} agency represented by`,
    ];
  }

  return [
    `(${allExacts}) site:open.spotify.com/artist`,
    `(${allExacts}) site:music.apple.com artist`,
    `(${allExacts}) site:soundcloud.com`,
    `(${allExacts}) site:youtube.com channel`,
    `(${allExacts}) site:instagram.com`,
    `(${allExacts}) site:imdb.com/name`,
    `(${allExacts}) site:behance.net`,
    `(${allExacts}) site:dribbble.com`,
    `(${allExacts}) site:muso.ai`,
    // Broader coverage -- these platforms were already scored on if they
    // happened to surface from a generic query, but were never actually
    // searched for directly, so real matches living only on them were
    // routinely missed.
    `(${allExacts}) site:tiktok.com`,
    `(${allExacts}) site:vimeo.com`,
    `(${allExacts}) site:artstation.com`,
    `(${allExacts}) site:x.com OR site:twitter.com`,
    `(${allExacts}) site:genius.com/artists`,
    `(${allExacts}) site:discogs.com artist`,
    `(${allExacts}) site:letterboxd.com`,
    `(${allExacts}) site:models.com`,
    `(${allExacts}) producer artist creator official`,
    `${exact} worked with artist producer`,
    `${exact} portfolio bio credits interview`,
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function firecrawlSearch(apiKey: string, query: string, limit: number): Promise<FirecrawlResult[]> {
  // Firecrawl rate-limits aggressively (HTTP 429) when the whole query fan-out
  // fires at once. Retry a rate-limited query a couple of times with backoff,
  // honouring Retry-After when the API sends it.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit }),
      });

      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8000)
          : 1500 * (attempt + 1);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        console.warn(`Firecrawl query failed (${res.status}):`, query.substring(0, 80));
        return [];
      }

      const data = await res.json();
      return Array.isArray(data?.data) ? data.data : [];
    } catch {
      return [];
    }
  }
  console.warn('Firecrawl query still rate limited after retries:', query.substring(0, 80));
  return [];
}

/** Runs the query fan-out with bounded concurrency so we stay under quota. */
async function firecrawlSearchAll(
  apiKey: string,
  queries: string[],
  limit: number,
  concurrency = 3,
): Promise<FirecrawlResult[][]> {
  const out: FirecrawlResult[][] = new Array(queries.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, queries.length) }, async () => {
    while (cursor < queries.length) {
      const i = cursor++;
      out[i] = await firecrawlSearch(apiKey, queries[i], limit);
    }
  });
  await Promise.all(workers);
  return out;
}

async function firecrawlScrape(apiKey: string, url: string): Promise<{ markdown: string; image_url: string | null }> {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) return { markdown: '', image_url: null };
    const data = await res.json();
    const scrapeData = data?.data || data || {};
    const markdown = scrapeData?.markdown || '';
    const metadata = scrapeData?.metadata || {};
    const ogImage = metadata?.ogImage || metadata?.og?.image || metadata?.image || metadata?.twitter?.image;
    const image_url = (typeof ogImage === 'string' && ogImage.startsWith('http')) ? ogImage : null;
    return { markdown, image_url };
  } catch {
    return { markdown: '', image_url: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, creator_name } = await req.json();

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmedQuery = query.trim();
    const creatorQuery = looksLikeCreatorQuery(trimmedQuery) || Boolean(creator_name);
    let webSnippets: string[] = [];

    if (FIRECRAWL_API_KEY) {
      try {
        const queries = buildSearchQueries(trimmedQuery, creatorQuery);
        const queryResults = await firecrawlSearchAll(FIRECRAWL_API_KEY, queries, 5);

        const uniqueResults = new Map<string, FirecrawlResult>();
        for (const batch of queryResults) {
          for (const result of batch) {
            const url = (result.url || '').toLowerCase();
            if (!url || uniqueResults.has(url)) continue;
            uniqueResults.set(url, result);
          }
        }

        const rankedResults = Array.from(uniqueResults.values())
          .sort((a, b) => scoreSearchCandidate(b, trimmedQuery, creatorQuery) - scoreSearchCandidate(a, trimmedQuery, creatorQuery));

        const scrapeTargets = rankedResults
          .filter((result) => isLikelyProfileUrl(result.url || ''))
          .slice(0, 8);

        const scrapedEntries = await Promise.all(
          scrapeTargets.map(async (result) => {
            const url = result.url || '';
            const scraped = await firecrawlScrape(FIRECRAWL_API_KEY, url);
            return { url: url.toLowerCase(), excerpt: extractPageExcerpt(scraped.markdown), image_url: scraped.image_url };
          })
        );

        const scrapedByUrl = new Map<string, { excerpt: string; image_url: string | null }>();
        for (const entry of scrapedEntries) {
          if (entry.excerpt || entry.image_url) {
            scrapedByUrl.set(entry.url, { excerpt: entry.excerpt, image_url: entry.image_url });
          }
        }

        for (const result of rankedResults.slice(0, 28)) {
          const url = result.url || '';
          const searchImageUrl = extractImageUrl(result);
          const scraped = scrapedByUrl.get(url.toLowerCase());
          const pageExcerpt = scraped?.excerpt || extractPageExcerpt(result.markdown);
          const bestImageUrl = searchImageUrl || scraped?.image_url || null;
          const platformHint = detectPlatformFromUrl(url);

          const snippet = [
            result.title ? `Title: ${result.title}` : '',
            platformHint ? `PlatformHint: ${platformHint}` : '',
            url ? `URL: ${url}` : '',
            bestImageUrl ? `Image: ${bestImageUrl}` : '',
            result.description ? `Description: ${result.description}` : '',
            pageExcerpt ? `PageExcerpt: ${pageExcerpt}` : '',
          ].filter(Boolean).join('\n');

          if (snippet.length > 30) {
            webSnippets.push(snippet);
          }
        }

        console.log(`Firecrawl found ${rankedResults.length} unique results across ${queries.length} queries and scraped ${scrapeTargets.length} pages for "${trimmedQuery}"`);
      } catch (fcErr) {
        console.error('Firecrawl error:', fcErr);
      }
    } else {
      console.warn('FIRECRAWL_API_KEY not configured');
    }

    const hasWebData = webSnippets.length > 0;
    const webContext = hasWebData
      ? `\n\nHere are REAL web search results and page excerpts from creative platforms and the broader web. ONLY return information explicitly supported by these results. Prioritize official profile/channel pages, major creative databases, then flagship works, then broader web evidence.\n\nIMPORTANT: If the results reference MULTIPLE DIFFERENT people/entities with the same or similar name, include ALL of them as separate results with distinct types/descriptions so the user can identify the right one.\n\n${webSnippets.slice(0, 22).join('\n---\n')}`
      : '';

    const searchPrompt = creator_name
      ? `Find creative professional credits for "${trimmedQuery}" by or featuring "${creator_name}".${webContext}`
      : creatorQuery
        ? `Find ALL matching creators/profiles/channels and their key works for "${trimmedQuery}". If there are multiple different people with this name, include each one as a separate result.${webContext}`
        : `Find creative projects/works matching "${trimmedQuery}".${webContext}`;

    const systemPrompt = hasWebData
      ? `You are a creative industry discovery engine. You MUST ONLY extract and structure information from the provided search results and page excerpts. Do NOT fabricate, hallucinate, or guess.

Each result should have:
- "title": exact name as found in results
- "type": one of: film, tv, short_film, documentary, music_video, web_series, album, single, ep, concert, festival, live_event, fashion_show, exhibition, podcast, audiobook, youtube_series, brand_campaign, theatre, musical, dance, comedy, spoken_word, opera, photography, animation, art_exhibition, commercial, runway, editorial_shoot, workshop, conference, carnival, pageant, awards_show, ugc_campaign, livestream, online_course, voiceover, influencer_campaign, mural, graphic_design, fashion_collection, beauty_campaign, styling, talent_management, booking, label_release, publishing, curation, tour, choreography, backup_dancer, dj_set, mc_hosting, soca, dancehall, afrobeats, gospel_concert, corporate, beauty, makeup, creator_profile, music_producer, artist_profile, streamer, model, photographer, podcaster
- "role_suggestion": person's role IF clearly stated, otherwise null
- "year": year if found, otherwise null
- "platform": source platform (Spotify, Apple Music, SoundCloud, IMDb, YouTube, Instagram, TikTok, Behance, Dribbble, LinkedIn, Vimeo, Eventbrite, Muso, etc.)
- "description": one-line grounded description from the ACTUAL source content
- "url": actual URL from the search result
- "image_url": any real image URL found, otherwise null
- "location": location if mentioned
- "client_brand": brand/studio/label if mentioned
- "monthly_listeners": number if explicitly mentioned
- "follower_count": follower/subscriber count if explicitly mentioned

If the query is for a creator, prioritize:
1. Official or profile pages on major creative databases
2. Strong evidence of identity like credits, collaborators, listeners, followers
3. Diverse platforms rather than duplicates from the same site

Return fewer results rather than made-up ones. Return up to 12 results.`
      : `You are a creative industry search engine. Return structured results for REAL creative work only. If uncertain, return fewer results.

Each result should have: "title", "type", "role_suggestion", "year", "platform", "description", "url", "image_url", "location", "client_brand".

Return up to 8 most relevant REAL results.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nRespond with a JSON object: { "results": [...] }` },
          { role: 'user', content: searchPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('AI structuring error:', status, await aiResponse.text());
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    let rawResults: any[] = [];

    if (content) {
      try {
        const parsed = JSON.parse(content);
        rawResults = Array.isArray(parsed) ? parsed : (parsed.results || []);
        console.log(`AI returned ${rawResults.length} results`);
      } catch {
        try {
          const cleaned = content
            .replace(/^```json\s*/im, '')
            .replace(/^```\s*/im, '')
            .replace(/```\s*$/im, '')
            .trim();
          const parsed = JSON.parse(cleaned);
          rawResults = Array.isArray(parsed) ? parsed : (parsed.results || []);
          console.log(`AI cleaned JSON returned ${rawResults.length} results`);
        } catch (e2) {
          console.error('Failed to parse AI response:', e2, 'Content preview:', content.slice(0, 200));
        }
      }
    }

    if (rawResults.length === 0) {
      console.warn('AI returned 0 results. Content length:', content.length);
    }

    const seen = new Set<string>();
    const platformCounts = new Map<string, number>();

    const results = rawResults
      .filter((result: any) => result?.title && result?.type)
      .map((result: any) => ({
        ...result,
        _source: hasWebData ? 'web_verified' : 'ai_knowledge',
      }))
      .sort((a: any, b: any) => scoreResult(b, trimmedQuery, creatorQuery) - scoreResult(a, trimmedQuery, creatorQuery))
      .filter((result: any) => {
        const dedupeKey = `${normalizeText(result.title)}|${normalizeText(result.platform)}|${(result.url || '').toLowerCase()}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);

        if (creatorQuery) {
          const platformKey = normalizeText(result.platform) || 'unknown';
          const count = platformCounts.get(platformKey) || 0;
          if (count >= 3) return false;
          platformCounts.set(platformKey, count + 1);
        }

        return true;
      })
      .slice(0, 12);

    return new Response(JSON.stringify({ results, source: hasWebData ? 'web' : 'ai' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in search-credits-web:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});