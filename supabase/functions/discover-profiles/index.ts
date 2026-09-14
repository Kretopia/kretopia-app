import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiscoveredProfile {
  name: string;
  role: string;
  bio?: string;
  location?: string;
  sourceUrl: string;
  skills?: string[];
  imageUrl?: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchType, query, platform, page = 1 } = await req.json();
    console.log("Discovery request:", { searchType, query, platform, page });

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Web search not configured. Please connect Firecrawl in settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let discoveredProfiles: DiscoveredProfile[] = [];

    if (searchType === "name") {
      // Search for a specific person by name across multiple strategies
      console.log("=== NAME SEARCH ===");
      console.log("Searching for:", query);

      // Strategy 1: Direct search with creative industry terms
      const searchQueries = [
        `"${query}" site:imdb.com/name`,
        `"${query}" site:discogs.com/artist`,
        `"${query}" site:open.spotify.com/artist`,
        `"${query}" site:behance.net`,
        `"${query}" musician OR producer OR artist OR director OR filmmaker OR songwriter OR designer`,
        `"${query}" professional portfolio biography`,
      ];

      // Run multiple searches in parallel for speed
      const searchPromises = searchQueries.slice(0, 3).map(async (searchQuery) => {
        try {
          console.log("Searching:", searchQuery);
          const response = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: searchQuery,
              limit: 10,
              scrapeOptions: { formats: ["markdown"] },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            return data.data || [];
          }
          return [];
        } catch (e) {
          console.error("Search error:", e);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      const flatResults = allResults.flat();
      console.log("Total search results:", flatResults.length);

      // Deduplicate by URL
      const uniqueUrls = new Map();
      for (const result of flatResults) {
        if (result.url && !uniqueUrls.has(result.url)) {
          uniqueUrls.set(result.url, result);
        }
      }
      const uniqueResults = Array.from(uniqueUrls.values());
      console.log("Unique results:", uniqueResults.length);

      // Process results with AI extraction (in parallel batches)
      const batchSize = 5;
      for (let i = 0; i < Math.min(uniqueResults.length, 15); i += batchSize) {
        const batch = uniqueResults.slice(i, i + batchSize);
        const extractionPromises = batch.map(async (result: any) => {
          // Skip LinkedIn
          if (result.url?.includes('linkedin.com')) return null;
          
          const content = result.markdown || result.description || result.title || '';
          if (!content || content.length < 30) return null;

          return extractProfileWithAI(content, result.url, query, LOVABLE_API_KEY);
        });

        const batchProfiles = await Promise.all(extractionPromises);
        discoveredProfiles.push(...batchProfiles.filter((p): p is DiscoveredProfile => p !== null));
      }

      console.log("Extracted profiles:", discoveredProfiles.length);

    } else if (searchType === "industry") {
      // Search for creators by industry/role
      console.log("=== INDUSTRY SEARCH ===");
      const searchQuery = `${query} professional portfolio creator artist`;
      console.log("Searching:", searchQuery);

      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          for (const result of data.data.slice(0, 15)) {
            const profile = await extractProfileWithAI(
              result.markdown || result.description,
              result.url,
              undefined,
              LOVABLE_API_KEY
            );
            if (profile) discoveredProfiles.push(profile);
          }
        }
      }

    } else if (searchType === "platform") {
      // Search within a specific platform
      console.log("=== PLATFORM SEARCH ===");
      const platformSearchQueries: Record<string, string> = {
        imdb: `site:imdb.com/name "${query}"`,
        discogs: `site:discogs.com/artist "${query}"`,
        spotify: `site:open.spotify.com/artist "${query}"`,
        behance: `site:behance.net "${query}"`,
        dribbble: `site:dribbble.com "${query}"`,
        youtube: `site:youtube.com/@"${query}" OR site:youtube.com/c/"${query}"`,
      };

      const searchQuery = platformSearchQueries[platform] || `site:${platform}.com "${query}"`;
      console.log("Searching:", searchQuery);

      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 15,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          for (const result of data.data.slice(0, 10)) {
            const profile = await extractProfileWithAI(
              result.markdown || result.description,
              result.url,
              query,
              LOVABLE_API_KEY
            );
            if (profile) discoveredProfiles.push(profile);
          }
        }
      }

    } else if (searchType === "news") {
      // Search news for mentions of creators
      console.log("=== NEWS SEARCH ===");
      const newsQuery = `"${query}" creator OR artist OR musician OR filmmaker site:variety.com OR site:billboard.com OR site:pitchfork.com OR site:hollywoodreporter.com`;

      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: newsQuery,
          limit: 15,
          tbs: "qdr:y", // Last year
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          for (const result of data.data.slice(0, 10)) {
            const profile = await extractProfileFromNews(
              result.markdown || result.description,
              result.url,
              LOVABLE_API_KEY
            );
            if (profile) discoveredProfiles.push(profile);
          }
        }
      }
    }

    // Deduplicate by name
    const uniqueProfiles = deduplicateProfiles(discoveredProfiles);
    
    // Sort by confidence
    uniqueProfiles.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    console.log(`=== RESULT: ${uniqueProfiles.length} unique profiles ===`);

    return new Response(
      JSON.stringify({
        success: true,
        profiles: uniqueProfiles,
        count: uniqueProfiles.length,
        page,
        hasMore: uniqueProfiles.length >= 10,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in discover-profiles:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Discovery failed",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractProfileWithAI(
  content: string,
  sourceUrl: string,
  searchHint: string | undefined,
  apiKey: string
): Promise<DiscoveredProfile | null> {
  try {
    if (!content || content.length < 30) return null;

    console.log("Extracting from:", sourceUrl.substring(0, 60));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: `You extract professional profile data from web content.
Only extract INDIVIDUAL creator profiles (musicians, producers, filmmakers, designers, artists, etc).
Skip company pages, product pages, lists, and generic content.
${searchHint ? `The user is searching for: "${searchHint}" - prioritize matches for this name.` : ''}`
          },
          {
            role: "user",
            content: `Extract the creator profile from this content:\n\n${content.substring(0, 15000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract a professional profile from web content",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name of the person" },
                  role: { type: "string", description: "Professional role/title" },
                  bio: { type: "string", description: "Brief bio (max 300 chars)" },
                  location: { type: "string", description: "Location if mentioned" },
                  skills: { type: "array", items: { type: "string" }, description: "Skills (max 5)" },
                  imageUrl: { type: "string", description: "Profile image URL if found" },
                  isValidProfile: { type: "boolean", description: "True if valid individual creator profile" },
                  confidence: { type: "number", description: "Confidence score 0-100 that this is the searched person" }
                },
                required: ["name", "role", "isValidProfile"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } }
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return null;
    }

    if (!extracted.isValidProfile || !extracted.name || extracted.name.length < 2) {
      return null;
    }

    console.log("✓ Extracted:", extracted.name);
    return {
      name: extracted.name,
      role: extracted.role || "Creator",
      bio: extracted.bio,
      location: extracted.location,
      sourceUrl,
      skills: extracted.skills?.slice(0, 5),
      imageUrl: extracted.imageUrl,
      confidence: extracted.confidence || 50,
    };
  } catch (e) {
    console.error("Extraction error:", e);
    return null;
  }
}

async function extractProfileFromNews(
  content: string,
  sourceUrl: string,
  apiKey: string
): Promise<DiscoveredProfile | null> {
  try {
    if (!content || content.length < 50) return null;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: "Extract the main creator/artist featured in this news article."
          },
          {
            role: "user",
            content: `Extract the main creator profile from this news:\n\n${content.substring(0, 12000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract profile from news",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  bio: { type: "string" },
                  isValidProfile: { type: "boolean" }
                },
                required: ["name", "role", "isValidProfile"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } }
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;

    const extracted = JSON.parse(toolCall.function.arguments);
    if (!extracted.isValidProfile || !extracted.name) return null;

    return {
      name: extracted.name,
      role: extracted.role || "Creator",
      bio: extracted.bio,
      sourceUrl,
      confidence: 60,
    };
  } catch {
    return null;
  }
}

function deduplicateProfiles(profiles: DiscoveredProfile[]): DiscoveredProfile[] {
  const seen = new Map<string, DiscoveredProfile>();
  
  for (const profile of profiles) {
    const key = profile.name.toLowerCase().trim();
    const existing = seen.get(key);
    
    // Keep the one with higher confidence or more data
    if (!existing || (profile.confidence || 0) > (existing.confidence || 0)) {
      seen.set(key, profile);
    }
  }
  
  return Array.from(seen.values());
}
