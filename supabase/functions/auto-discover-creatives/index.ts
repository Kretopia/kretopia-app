import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

// ========================================
// 🚫 AUTO-DISCOVERY PAUSED
// Set to true to resume automatic profile seeding
// Paused on: 2026-01-16 for manual outreach phase
// ========================================
const AUTO_DISCOVERY_ENABLED = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DiscoveredCreative {
  name: string;
  role: string;
  bio?: string;
  location?: string;
  sourceUrl?: string;
  avatarUrl?: string;
  skills?: string[];
  credits?: Array<{ project_name: string; role: string; year?: number; platform?: string }>;
  awards?: Array<{ title: string; organization: string; year?: number; category?: string }>;
  confidence: number;
}

interface DiscoverySource {
  type: 'news' | 'awards' | 'platform' | 'trending';
  query: string;
  priority: number;
}

// Discovery sources - BALANCED across creative industries
// Rotate through categories equally - each run picks from different fields
const discoverySources: DiscoverySource[] = [
  // === FILM & TV (HIGH PRIORITY) ===
  { type: 'news', query: 'Oscar nominated cinematographer DP 2024 2025', priority: 1 },
  { type: 'news', query: 'Emmy winning film editor colorist credits', priority: 1 },
  { type: 'news', query: 'VFX supervisor visual effects artist Oscar', priority: 1 },
  { type: 'news', query: 'production designer costume designer film credits', priority: 1 },
  { type: 'news', query: 'sound designer supervising sound editor credits', priority: 1 },
  { type: 'news', query: 'documentary director cinematographer Sundance', priority: 1 },
  { type: 'platform', query: 'site:imdb.com line producer unit production manager', priority: 2 },
  { type: 'news', query: 'stunt coordinator stunt performer SAG credits', priority: 2 },
  
  // === PHOTOGRAPHY (HIGH PRIORITY) ===
  { type: 'news', query: 'commercial photographer advertising campaign 2024', priority: 1 },
  { type: 'news', query: 'fashion photographer Vogue Elle Harper editorial', priority: 1 },
  { type: 'news', query: 'portrait photographer celebrity magazine cover', priority: 1 },
  { type: 'news', query: 'product photographer still life advertising', priority: 1 },
  { type: 'news', query: 'architecture photographer interior design editorial', priority: 2 },
  { type: 'news', query: 'sports photographer Olympics World Cup Reuters AP', priority: 2 },
  
  // === DESIGN & UI/UX (HIGH PRIORITY) ===
  { type: 'platform', query: 'site:behance.net senior product designer portfolio', priority: 1 },
  { type: 'platform', query: 'site:dribbble.com UX designer featured portfolio', priority: 1 },
  { type: 'news', query: 'brand identity designer agency Pentagram Landor', priority: 1 },
  { type: 'news', query: 'UI designer Apple Google Meta design team', priority: 1 },
  { type: 'news', query: 'motion graphics designer title sequence credits', priority: 2 },
  { type: 'news', query: 'type designer typography foundry font design', priority: 2 },
  
  // === ILLUSTRATION & ANIMATION (HIGH PRIORITY) ===
  { type: 'platform', query: 'site:artstation.com concept artist film game portfolio', priority: 1 },
  { type: 'news', query: 'Annie Award animator character designer Pixar Disney', priority: 1 },
  { type: 'news', query: 'illustrator New Yorker editorial book cover artist', priority: 1 },
  { type: 'news', query: '3D artist environment designer game studio', priority: 1 },
  { type: 'news', query: 'storyboard artist animation feature film credits', priority: 2 },
  
  // === GAMING (HIGH PRIORITY) ===
  { type: 'news', query: 'game designer lead developer AAA studio credits', priority: 1 },
  { type: 'news', query: 'game audio director composer sound designer', priority: 1 },
  { type: 'news', query: 'level designer senior environment artist game', priority: 2 },
  { type: 'platform', query: 'site:artstation.com character artist game studio', priority: 2 },
  
  // === WRITING & CONTENT (HIGH PRIORITY) ===
  { type: 'news', query: 'screenwriter WGA TV writer Emmy nominated', priority: 1 },
  { type: 'news', query: 'creative director copywriter Cannes Lions award', priority: 1 },
  { type: 'news', query: 'playwright dramatist theatre writer credits', priority: 2 },
  
  // === FASHION & BEAUTY (HIGH PRIORITY) ===
  { type: 'news', query: 'celebrity stylist fashion week editorial credits', priority: 1 },
  { type: 'news', query: 'makeup artist film beauty director credits', priority: 1 },
  { type: 'news', query: 'fashion designer CFDA emerging talent award', priority: 1 },
  { type: 'news', query: 'hair stylist creative director salon editorial', priority: 2 },
  
  // === ARCHITECTURE & INTERIOR ===
  { type: 'news', query: 'architect interior designer award winning project', priority: 1 },
  { type: 'news', query: 'set designer production designer Broadway theatre', priority: 2 },
  
  // === ADVERTISING & CREATIVE DIRECTION ===
  { type: 'news', query: 'Cannes Lions art director creative team 2024', priority: 1 },
  { type: 'news', query: 'executive creative director agency award campaign', priority: 2 },
  
  // === MUSIC (REDUCED - lower priority) ===
  { type: 'news', query: 'Grammy nominated mixing engineer mastering 2024', priority: 3 },
  { type: 'news', query: 'session musician studio drummer guitarist credits', priority: 3 },
  { type: 'platform', query: 'site:discogs.com mixing engineer mastering', priority: 3 },
  
  // === BALI & INDONESIA CREATIVES (BALANCED) ===
  { type: 'news', query: 'Bali photographer videographer creative professional', priority: 1 },
  { type: 'news', query: 'Bali graphic designer UI UX web design studio', priority: 1 },
  { type: 'news', query: 'Bali filmmaker cinematographer video production', priority: 1 },
  { type: 'news', query: 'Bali fashion photographer creative director', priority: 1 },
  { type: 'news', query: 'Ubud Canggu artist designer illustrator creative', priority: 2 },
  { type: 'news', query: 'Indonesia digital nomad creative Bali designer', priority: 2 },
  { type: 'news', query: 'Bali wedding photographer portrait photographer', priority: 2 },
  { type: 'news', query: 'Bali animator motion designer VFX artist', priority: 2 },
  { type: 'news', query: 'Indonesian creative agency Bali Jakarta studio', priority: 3 },
];

// Celebrity names to EXCLUDE - people too famous to use the platform
const CELEBRITY_EXCLUSIONS = new Set([
  // Music megastars / Legacy icons
  'beyoncé', 'beyonce', 'taylor swift', 'drake', 'kanye west', 'rihanna',
  'lady gaga', 'justin bieber', 'ariana grande', 'ed sheeran', 'adele',
  'the weeknd', 'bruno mars', 'post malone', 'dua lipa', 'billie eilish',
  'harry styles', 'bad bunny', 'kendrick lamar', 'travis scott', 'doja cat',
  'olivia rodrigo', 'justin timberlake', 'katy perry', 'miley cyrus', 'selena gomez',
  'paul mccartney', 'john lennon', 'ringo starr', 'george harrison', // Beatles
  'mick jagger', 'keith richards', // Rolling Stones
  'elton john', 'madonna', 'michael jackson', 'prince', 'stevie wonder',
  
  // A-list actors
  'tom hanks', 'leonardo dicaprio', 'brad pitt', 'angelina jolie', 'tom cruise',
  'scarlett johansson', 'robert downey jr', 'chris hemsworth', 'margot robbie',
  'jennifer lawrence', 'denzel washington', 'will smith', 'meryl streep',
  'ryan gosling', 'zendaya', 'timothée chalamet', 'florence pugh',
  
  // Major directors
  'steven spielberg', 'christopher nolan', 'martin scorsese', 'quentin tarantino',
  'james cameron', 'ridley scott', 'denis villeneuve', 'greta gerwig',
  'jordan peele', 'david fincher', 'wes anderson', 'guillermo del toro',
]);

// Check if a name is a celebrity to exclude
function isCelebrity(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return CELEBRITY_EXCLUSIONS.has(normalized) || 
    Array.from(CELEBRITY_EXCLUSIONS).some(celeb => 
      normalized.includes(celeb) || celeb.includes(normalized)
    );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if auto-discovery is paused
  if (!AUTO_DISCOVERY_ENABLED) {
    console.log('🚫 Auto-discovery is currently PAUSED');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-discovery is paused for manual outreach phase',
        paused: true,
        resumeInstructions: 'Set AUTO_DISCOVERY_ENABLED = true in the function to resume'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!FIRECRAWL_API_KEY || !LOVABLE_API_KEY) {
      throw new Error('Missing required API keys');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Parse optional parameters
    let maxProfiles = 20;
    let specificSource: string | null = null;
    
    try {
      const body = await req.json();
      maxProfiles = body.maxProfiles || 20;
      specificSource = body.source || null;
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`🤖 AI Creative Discovery Agent starting...`);
    console.log(`Target: ${maxProfiles} profiles`);
    
    const results: Array<{
      name: string;
      status: 'imported' | 'duplicate' | 'skipped' | 'error';
      role?: string;
      error?: string;
      enriched?: boolean;
    }> = [];

    const discoveredCreatives: DiscoveredCreative[] = [];
    const existingNames: Set<string> = new Set();

    // Get existing profile names to avoid duplicates
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('full_name, imported_from_url')
      .eq('is_claimed', false);

    if (existingProfiles) {
      existingProfiles.forEach(p => {
        if (p.full_name) existingNames.add(p.full_name.toLowerCase().trim());
      });
    }

    console.log(`📊 Found ${existingNames.size} existing unclaimed profiles`);

    // Select sources to search
    const sourcesToSearch = specificSource 
      ? discoverySources.filter(s => s.type === specificSource)
      : discoverySources.sort((a, b) => a.priority - b.priority).slice(0, 8);

    // Search each source
    for (const source of sourcesToSearch) {
      if (discoveredCreatives.length >= maxProfiles * 2) break;

      console.log(`🔍 Searching: ${source.query}`);

      try {
        // Use Firecrawl search
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: source.query,
            limit: 5,
            scrapeOptions: {
              formats: ['markdown'],
            },
          }),
        });

        if (!searchResponse.ok) {
          console.error(`Search failed for: ${source.query}`);
          continue;
        }

        const searchData = await searchResponse.json();
        const searchResults = searchData.data || [];

        // Extract creatives from search results using AI
        for (const result of searchResults) {
          if (discoveredCreatives.length >= maxProfiles * 2) break;

          const content = result.markdown || result.description || '';
          if (content.length < 100) continue;

          const extracted = await extractCreativesFromContent(
            content,
            result.url,
            source.type,
            LOVABLE_API_KEY!
          );

          for (const creative of extracted) {
            // Skip if celebrity
            if (isCelebrity(creative.name)) {
              console.log(`🚫 Skipping celebrity: ${creative.name}`);
              continue;
            }

            // Skip if already exists or already discovered
            const normalizedName = creative.name.toLowerCase().trim();
            if (existingNames.has(normalizedName)) {
              console.log(`⏭️ Skipping duplicate: ${creative.name}`);
              continue;
            }

            // Check if already discovered in this run
            if (discoveredCreatives.some(c => c.name.toLowerCase().trim() === normalizedName)) {
              continue;
            }

            discoveredCreatives.push(creative);
            console.log(`✨ Discovered: ${creative.name} (${creative.role})`);
          }
        }

        // Rate limiting between sources
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error searching ${source.query}:`, error);
      }
    }

    console.log(`📋 Total discovered: ${discoveredCreatives.length} creatives`);

    // Sort by confidence and take top profiles
    const topCreatives = discoveredCreatives
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxProfiles);

    console.log(`🎯 Processing top ${topCreatives.length} creatives...`);

    // Import each creative
    for (const creative of topCreatives) {
      try {
        // Final duplicate check
        const { data: existing } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .ilike('full_name', creative.name)
          .eq('is_claimed', false)
          .maybeSingle();

        if (existing) {
          results.push({
            name: creative.name,
            status: 'duplicate',
            role: creative.role,
          });
          continue;
        }

        // Enrich with additional web search if needed
        let enrichedCreative = creative;
        if (creative.confidence < 0.7 || !creative.credits?.length || !creative.avatarUrl) {
          console.log(`🔄 Enriching: ${creative.name}`);
          enrichedCreative = await enrichCreativeProfile(creative, FIRECRAWL_API_KEY!, LOVABLE_API_KEY!);
        }
        
        // Generate bio if still missing
        if (!enrichedCreative.bio && enrichedCreative.credits?.length) {
          const creditsList = enrichedCreative.credits.slice(0, 3).map(c => c.project_name).join(', ');
          enrichedCreative.bio = `${enrichedCreative.name} is a ${enrichedCreative.role} known for work on ${creditsList}.`;
        } else if (!enrichedCreative.bio) {
          enrichedCreative.bio = `${enrichedCreative.name} is a professional ${enrichedCreative.role} in the creative industry.`;
        }

        // Create the unclaimed profile
        const { data: newUserId, error: createError } = await supabase
          .rpc('create_unclaimed_profile', {
            p_full_name: enrichedCreative.name,
            p_role: enrichedCreative.role || 'Creative',
            p_bio: enrichedCreative.bio,
            p_avatar_url: enrichedCreative.avatarUrl || null,
            p_location: enrichedCreative.location || null,
            p_professional_skills: enrichedCreative.skills ? JSON.stringify(
              enrichedCreative.skills.map(s => ({ name: s, level: 'advanced' }))
            ) : '[]',
            p_imported_data: JSON.stringify({
              source: 'ai_discovery',
              discovered_at: new Date().toISOString(),
              source_url: enrichedCreative.sourceUrl,
              confidence: enrichedCreative.confidence,
            }),
            p_imported_from_url: enrichedCreative.sourceUrl || null,
            p_source: 'ai_discovery',
          });

        if (createError) throw createError;

        // Add credits
        if (enrichedCreative.credits?.length && newUserId) {
          for (const credit of enrichedCreative.credits.slice(0, 20)) {
            await supabase.from('credits').insert({
              user_id: newUserId,
              project_name: credit.project_name,
              role: credit.role,
              year: credit.year,
              platform: credit.platform,
              verification_status: 'imported',
            });
          }
        }

        // Add awards
        if (enrichedCreative.awards?.length && newUserId) {
          for (const award of enrichedCreative.awards.slice(0, 10)) {
            await supabase.from('awards').insert({
              user_id: newUserId,
              title: award.title,
              organization: award.organization,
              year: award.year,
              category: award.category,
              verification_status: 'imported',
            });
          }
        }

        // Update badge to 'beta' for AI discovered profiles
        await supabase
          .from('profiles')
          .update({ badge: 'beta' })
          .eq('user_id', newUserId);

        results.push({
          name: enrichedCreative.name,
          status: 'imported',
          role: enrichedCreative.role,
          enriched: enrichedCreative !== creative,
        });

        console.log(`✅ Imported: ${enrichedCreative.name}`);

        // Rate limiting between imports
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Error importing ${creative.name}:`, error);
        results.push({
          name: creative.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log agent run to database for tracking
    await supabase.from('analytics_events').insert({
      event_name: 'ai_discovery_run',
      event_category: 'automation',
      event_properties: {
        discovered: discoveredCreatives.length,
        imported: results.filter(r => r.status === 'imported').length,
        duplicates: results.filter(r => r.status === 'duplicate').length,
        errors: results.filter(r => r.status === 'error').length,
      },
    });

    const summary = {
      discovered: discoveredCreatives.length,
      processed: results.length,
      imported: results.filter(r => r.status === 'imported').length,
      enriched: results.filter(r => r.enriched).length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    console.log(`📈 Agent run complete:`, summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Discovery Agent error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractCreativesFromContent(
  content: string,
  sourceUrl: string,
  sourceType: string,
  apiKey: string
): Promise<DiscoveredCreative[]> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: 'system',
            content: `You are an expert at identifying WORKING creative professionals - the collaborators and crew BEHIND major projects, NOT celebrities.

TARGET ROLES (prioritize these - aim for diverse industries):
- Film/TV: cinematographers, editors, colorists, VFX artists, sound designers, costume designers, production designers, gaffers, grips, line producers, assistant directors, stunt coordinators
- Photography: fashion photographers, commercial photographers, portrait photographers, documentary photographers
- Design: graphic designers, UI/UX designers, product designers, motion designers, art directors, brand designers, type designers
- Illustration/Animation: illustrators, concept artists, 3D artists, animators, storyboard artists, character designers
- Gaming: game designers, level designers, environment artists, game audio designers
- Writing: screenwriters, TV writers, copywriters, content creators
- Fashion: stylists, makeup artists, hair stylists, emerging fashion designers
- Architecture/Set: architects, interior designers, set designers
- Music: producers, engineers, mixers, session musicians, songwriters, arrangers (but don't over-index here)
- Advertising: creative directors, copywriters, art directors

DO NOT EXTRACT:
- Major celebrities (Beyoncé, Taylor Swift, Drake, Tom Hanks, etc.)
- Famous actors or lead performers
- Well-known directors (Spielberg, Nolan, Scorsese, etc.)
- Anyone with 1M+ social followers or household name recognition
- Famous musicians/artists who are primarily performers

STRICT RULES:
- Focus on the CREW and COLLABORATORS mentioned in articles
- Look for people credited as working ON projects, not starring IN them
- Prioritize people with technical/craft roles
- Must have clear professional role/title
- Skip fictional characters, band names, company names
- AIM FOR DIVERSITY: Include people from Film, Design, Photography, Gaming, not just Music`
          },
          {
            role: 'user',
            content: `Extract creative professionals from this ${sourceType} content:\n\n${content.slice(0, 8000)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_creatives',
              description: 'Extract creative professionals from content',
              parameters: {
                type: 'object',
                properties: {
                  creatives: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Full name of the creative professional' },
                        role: { type: 'string', description: 'Primary professional role (e.g., Music Producer, Film Director, Graphic Designer)' },
                        bio: { type: 'string', description: 'Brief professional bio (2-3 sentences). If not explicitly stated, generate one based on their role and credits.' },
                        location: { type: 'string', description: 'Location if mentioned' },
                        avatarUrl: { type: 'string', description: 'URL to profile image/headshot if found in the content' },
                        skills: { type: 'array', items: { type: 'string' }, description: 'Professional skills' },
                        credits: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              project_name: { type: 'string' },
                              role: { type: 'string' },
                              year: { type: 'number' },
                              platform: { type: 'string' }
                            }
                          },
                          description: 'Notable works/credits mentioned'
                        },
                        awards: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              title: { type: 'string' },
                              organization: { type: 'string' },
                              year: { type: 'number' },
                              category: { type: 'string' }
                            }
                          },
                          description: 'Awards or nominations mentioned'
                        },
                        confidence: { type: 'number', description: 'Confidence score 0-1 that this is a real verifiable creative professional' }
                      },
                      required: ['name', 'role', 'confidence']
                    }
                  }
                },
                required: ['creatives']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_creatives' } }
      }),
    });

    if (!response.ok) {
      console.error('AI extraction failed:', await response.text());
      return [];
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const creatives = parsed.creatives || [];

    // Filter by confidence and add source
    return creatives
      .filter((c: any) => c.confidence >= 0.6 && c.name && c.role)
      .map((c: any) => ({
        ...c,
        sourceUrl,
      }));

  } catch (error) {
    console.error('Error extracting creatives:', error);
    return [];
  }
}

async function enrichCreativeProfile(
  creative: DiscoveredCreative,
  firecrawlKey: string,
  lovableKey: string
): Promise<DiscoveredCreative> {
  try {
    // Search for more info about this person
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `"${creative.name}" ${creative.role} credits portfolio`,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    if (!searchResponse.ok) return creative;

    const searchData = await searchResponse.json();
    const results = searchData.data || [];
    
    if (!results.length) return creative;

    // Combine all content
    const combinedContent = results
      .map((r: any) => r.markdown || r.description || '')
      .join('\n\n')
      .slice(0, 12000);

    // Use AI to enrich the profile
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: 'system',
            content: `You are enriching a creative professional's profile. Extract additional information about ${creative.name} who is a ${creative.role}.
Focus on:
- Professional bio and background
- Location
- Skills and expertise
- Notable works/credits (with years if available)
- Awards and nominations (Grammy, Oscar, Emmy, etc.)
Keep only verified, factual information.`
          },
          {
            role: 'user',
            content: `Enrich the profile for ${creative.name}:\n\n${combinedContent}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'enrich_profile',
              description: 'Enrich creative profile with additional information',
              parameters: {
                type: 'object',
                properties: {
                  bio: { type: 'string', description: 'Professional bio (2-3 sentences)' },
                  location: { type: 'string' },
                  avatarUrl: { type: 'string', description: 'URL to profile image/headshot if found' },
                  skills: { type: 'array', items: { type: 'string' } },
                  credits: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        project_name: { type: 'string' },
                        role: { type: 'string' },
                        year: { type: 'number' },
                        platform: { type: 'string' }
                      }
                    }
                  },
                  awards: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        organization: { type: 'string' },
                        year: { type: 'number' },
                        category: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'enrich_profile' } }
      }),
    });

    if (!response.ok) return creative;

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) return creative;

    const enriched = JSON.parse(toolCall.function.arguments);

    return {
      ...creative,
      bio: enriched.bio || creative.bio,
      location: enriched.location || creative.location,
      avatarUrl: enriched.avatarUrl || creative.avatarUrl,
      skills: [...new Set([...(creative.skills || []), ...(enriched.skills || [])])],
      credits: [...(creative.credits || []), ...(enriched.credits || [])].slice(0, 25),
      awards: [...(creative.awards || []), ...(enriched.awards || [])].slice(0, 15),
      confidence: Math.min(creative.confidence + 0.1, 1),
    };

  } catch (error) {
    console.error('Error enriching profile:', error);
    return creative;
  }
}
