import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function detectPlatform(url: string): { platform: string; instruction: string } {
  const u = url.toLowerCase();
  if (u.includes("behance.net")) return {
    platform: "behance",
    instruction: `This is a BEHANCE profile. Extract ALL portfolio projects. Each project URL should be the full gallery URL (https://www.behance.net/gallery/XXXXXXXX/...). Include cover/thumbnail images.`
  };
  if (u.includes("artstation.com")) return {
    platform: "artstation",
    instruction: `This is an ARTSTATION profile. Extract ALL artwork/project entries with their full URLs, titles, descriptions, and thumbnail images.`
  };
  if (u.includes("dribbble.com")) return {
    platform: "dribbble",
    instruction: `This is a DRIBBBLE profile. Extract ALL shots/projects with their URLs, titles, and image URLs.`
  };
  if (u.includes("github.com")) return {
    platform: "github",
    instruction: `This is a GITHUB profile. Extract pinned/popular repositories as portfolio items (repo URL as media_url), bio, skills (programming languages), and any linked social profiles.`
  };
  if (u.includes("youtube.com") || u.includes("youtu.be")) return {
    platform: "youtube",
    instruction: `This is a YOUTUBE channel/profile. Extract recent/popular videos as portfolio items (video URL as media_url, media_type "video"), channel name, description, and subscriber info.`
  };
  if (u.includes("vimeo.com")) return {
    platform: "vimeo",
    instruction: `This is a VIMEO profile. Extract ALL video works as portfolio items (video URL as media_url, media_type "video"), with titles, descriptions, and thumbnails.`
  };
  if (u.includes("soundcloud.com")) return {
    platform: "soundcloud",
    instruction: `This is a SOUNDCLOUD profile. Extract tracks/albums as portfolio items (track URL as media_url, media_type "audio"), artist name, bio, and genres as skills.`
  };
  if (u.includes("spotify.com")) return {
    platform: "spotify",
    instruction: `This is a SPOTIFY profile/page. Extract any visible tracks, albums, or playlists as portfolio items (media_type "audio"). Extract artist name, bio, and genres.`
  };
  if (u.includes("imdb.com")) return {
    platform: "imdb",
    instruction: `This is an IMDB profile. Extract filmography entries as credits (project_name, role, year). Extract any awards. The person's name and bio are critical.`
  };
  if (u.includes("instagram.com")) return {
    platform: "instagram",
    instruction: `This is an INSTAGRAM profile. Extract the bio, follower count, and any visible posts as portfolio items. Note: Instagram may block scraping.`
  };
  if (u.includes("twitter.com") || u.includes("x.com")) return {
    platform: "twitter",
    instruction: `This is a TWITTER/X profile. Extract the bio, handle, and any pinned content. Note: X may block scraping.`
  };
  if (u.includes("deviantart.com")) return {
    platform: "deviantart",
    instruction: `This is a DEVIANTART profile. Extract ALL artwork/deviations as portfolio items with their URLs, titles, and thumbnail images.`
  };
  if (u.includes("500px.com")) return {
    platform: "500px",
    instruction: `This is a 500PX profile. Extract ALL photos as portfolio items with URLs, titles, and thumbnails.`
  };
  if (u.includes("medium.com")) return {
    platform: "medium",
    instruction: `This is a MEDIUM profile. Extract articles as portfolio items (article URL as media_url, media_type "image"), author name, and bio.`
  };
  if (u.includes("cargo.site") || u.includes("squarespace.com") || u.includes("wix.com") || u.includes("webflow.io") || u.includes("myportfolio.com")) return {
    platform: "portfolio_site",
    instruction: `This is a personal PORTFOLIO WEBSITE. Extract ALL projects/works shown with their titles, descriptions, images, and links. Also extract the creator's name, role, bio, skills, and contact info.`
  };
  return {
    platform: "generic",
    instruction: `This is a website or personal portfolio. Extract any professional profile information and ALL works/projects/content items visible. Treat each distinct work, project, or content piece as a portfolio item.`
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log("Analyzing URL:", url);

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LinkedIn block check
    if (url.toLowerCase().includes('linkedin.com')) {
      return new Response(
        JSON.stringify({ 
          error: "LinkedIn blocks automated profile scraping. Please manually copy-paste your information or try another profile URL.",
          success: false,
          isLinkedInBlock: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { platform, instruction } = detectPlatform(url);
    console.log("Detected platform:", platform);

    let html = "";
    let pageMarkdown = "";
    let pageLinks: string[] = [];
    let pageImages: string[] = [];

    // Use Firecrawl for JS-rendered pages
    if (FIRECRAWL_API_KEY) {
      console.log("Using Firecrawl to scrape...");
      try {
        const fcResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: ["markdown", "links"],
            onlyMainContent: false,
            waitFor: 5000,
          }),
        });

        if (fcResponse.ok) {
          const fcData = await fcResponse.json();
          const payload = fcData.data || fcData;
          pageMarkdown = payload.markdown || "";
          pageLinks = Array.isArray(payload.links) ? payload.links : [];
          // Extract image URLs from markdown ![alt](url) syntax
          const imgMatches = [...pageMarkdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)];
          pageImages = imgMatches.map(m => m[1]);
          console.log("Firecrawl success — markdown:", pageMarkdown.length, "links:", pageLinks.length, "images:", pageImages.length);
        } else {
          console.log("Firecrawl failed:", fcResponse.status);
        }
      } catch (e) {
        console.error("Firecrawl error:", e);
      }
    }

    // Fallback to direct fetch
    if (!pageMarkdown || pageMarkdown.length < 200) {
      console.log("Fallback: direct fetch...");
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
        });

        if (response.ok) {
          html = await response.text();
          console.log("Direct fetch HTML length:", html.length);
        } else if (response.status === 999) {
          return new Response(
            JSON.stringify({ error: "This site blocks automated access.", success: false }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log("Direct fetch failed:", response.status);
        }
      } catch (e) {
        console.error("Direct fetch error:", e);
      }
    }

    const contentToAnalyze = pageMarkdown || html;
    if (!contentToAnalyze || contentToAnalyze.length < 50) {
      throw new Error("Could not retrieve content from this URL. The site may block automated access.");
    }

    // Use AI to analyze
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: `You are a STRICT EXTRACTIVE parser for professional portfolio data. You DO NOT invent, summarize, or guess.

PLATFORM-SPECIFIC INSTRUCTIONS:
${instruction}

CRITICAL RULES — VIOLATING THESE = FAILED EXTRACTION:
1. EVERY portfolio_item.media_url MUST be copied verbatim from the LINKS LIST or IMAGES LIST below. Never fabricate, abbreviate, or guess URLs.
2. EVERY thumbnail_url MUST be from the IMAGES LIST or be empty. Never invent image URLs.
3. If you can't find a real URL for an item in the lists, OMIT THE ITEM. Better to return 5 real items than 20 hallucinated ones.
4. Titles must be copied from text near the link in the page content — do NOT generate creative titles.
5. Skip navigation links (home, about, contact, login, signup, terms, privacy, etc.).
6. Skip social profile links — those go in social_links, not portfolio_items.
7. For media_type: inspect the URL itself. .mp4/.mov/youtube/vimeo/tiktok = video. .mp3/.wav/spotify/soundcloud = audio. Otherwise image.

Be conservative. Quality > quantity. The user will see a checkbox preview and can deselect — but only if items are real.`
          },
          {
            role: "user",
            content: `Source URL: ${url}\nPlatform: ${platform}\n\n=== ALL LINKS ON PAGE (use ONLY these for media_url) ===\n${pageLinks.slice(0, 200).join("\n")}\n\n=== ALL IMAGES ON PAGE (use ONLY these for thumbnail_url) ===\n${pageImages.slice(0, 100).join("\n")}\n\n=== PAGE CONTENT (for context only) ===\n${contentToAnalyze.substring(0, 60000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile_data",
              description: "Extract structured profile and portfolio data from a webpage",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Person or company name" },
                  bio: { type: "string", description: "Professional bio or about section" },
                  role: { type: "string", description: "Job title or professional role" },
                  location: { type: "string", description: "City, country or location" },
                  skills: { type: "array", items: { type: "string" }, description: "Professional skills, tools, or technologies" },
                  social_links: {
                    type: "object",
                    properties: {
                      website: { type: "string" },
                      linkedin_url: { type: "string" },
                      twitter_url: { type: "string" },
                      instagram_url: { type: "string" },
                      youtube_url: { type: "string" },
                      spotify_url: { type: "string" },
                      imdb_url: { type: "string" },
                      behance_url: { type: "string" },
                      github_url: { type: "string" },
                      dribbble_url: { type: "string" },
                      vimeo_url: { type: "string" },
                      soundcloud_url: { type: "string" },
                      tiktok_url: { type: "string" }
                    }
                  },
                  portfolio_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Project/work title" },
                        description: { type: "string", description: "Brief description" },
                        media_url: { type: "string", description: "URL to the project page or content. This is the MOST important field." },
                        thumbnail_url: { type: "string", description: "URL to the thumbnail/cover image" },
                        media_type: { type: "string", enum: ["image", "video", "audio"], description: "Type of content" },
                        tags: { type: "array", items: { type: "string" }, description: "Tags or categories" }
                      },
                      required: ["title", "media_url"]
                    },
                    description: "ALL portfolio projects/works visible on the page. Extract EVERY one."
                  },
                  awards: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        organization: { type: "string" },
                        year: { type: "integer" }
                      }
                    }
                  },
                  press_links: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        url: { type: "string" },
                        publication: { type: "string" }
                      }
                    }
                  },
                  credits: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project_name: { type: "string" },
                        role: { type: "string" },
                        year: { type: "integer" },
                        url: { type: "string" }
                      }
                    }
                  }
                },
                required: []
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile_data" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No profile data extracted from AI");
    }

    const profileData = JSON.parse(toolCall.function.arguments);
    
    // ============ ANTI-HALLUCINATION VALIDATION ============
    // Filter portfolio_items: media_url MUST exist in pageLinks (or be the source URL itself)
    // This stops the AI from inventing URLs.
    const linkSet = new Set(pageLinks.map(l => l.split("#")[0].replace(/\/$/, "")));
    const imageSet = new Set(pageImages);
    const SKIP_PATHS = /\/(login|signup|sign-in|sign-up|register|terms|privacy|cookie|contact|about|help|support|faq|pricing|subscribe|cart|checkout|account|settings)(\/|$|\?)/i;

    if (Array.isArray(profileData.portfolio_items)) {
      const before = profileData.portfolio_items.length;
      profileData.portfolio_items = profileData.portfolio_items.filter((item: any) => {
        if (!item?.media_url || typeof item.media_url !== "string") return false;
        const normalized = item.media_url.split("#")[0].replace(/\/$/, "");
        // Must be in scraped links OR be the source page itself
        const isReal = linkSet.has(normalized) || pageLinks.some(l => l.startsWith(item.media_url));
        if (!isReal) {
          console.log("Filtered hallucinated item:", item.title, "→", item.media_url);
          return false;
        }
        // Skip nav/auth pages
        if (SKIP_PATHS.test(normalized)) {
          console.log("Filtered nav link:", item.media_url);
          return false;
        }
        // Strip thumbnail if AI invented one not in image list
        if (item.thumbnail_url && !imageSet.has(item.thumbnail_url) && !item.thumbnail_url.startsWith("https://img.youtube.com")) {
          item.thumbnail_url = "";
        }
        return true;
      });
      console.log(`Validation: ${before} items → ${profileData.portfolio_items.length} real items`);
    }
    
    // Add source platform metadata
    profileData._source_platform = platform;
    profileData._source_url = url;
    profileData._scraped_links_count = pageLinks.length;

    console.log("Extracted:", JSON.stringify({
      platform,
      name: profileData.full_name,
      role: profileData.role,
      skills: profileData.skills?.length || 0,
      portfolio: profileData.portfolio_items?.length || 0,
      awards: profileData.awards?.length || 0,
      credits: profileData.credits?.length || 0,
      press: profileData.press_links?.length || 0,
    }));

    return new Response(
      JSON.stringify({ success: true, data: profileData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing profile URL:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
