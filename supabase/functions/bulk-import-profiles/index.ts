import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContactEntry {
  name: string;
  email?: string;
  role?: string;
  company?: string;
}

interface EnrichedProfile {
  name: string;
  role: string;
  bio?: string;
  location?: string;
  skills?: string[];
  imageUrl?: string;
  sourceUrl?: string;
  status: 'found' | 'not_found' | 'error';
  errorMessage?: string;
  credits?: number;
  awards?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const { contacts, importDirectly = false } = await req.json();
    
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No contacts provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing", contacts.length, "contacts with AI enrichment");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: EnrichedProfile[] = [];
    let importedCount = 0;

    // Process contacts in batches to avoid rate limits
    const batchSize = 2; // Smaller batches for better AI processing
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (contact: ContactEntry) => {
        const name = contact.name?.trim();
        if (!name || name.length < 2) {
          return {
            name: name || 'Unknown',
            role: 'Unknown',
            status: 'error' as const,
            errorMessage: 'Invalid name'
          };
        }

        console.log("Processing:", name);

        // If Firecrawl is available, search for the person online
        if (FIRECRAWL_API_KEY) {
          try {
            // Search for this person's professional profile across major platforms
            const searchQuery = `"${name}" ${contact.role || ''} ${contact.company || ''} musician OR producer OR artist OR filmmaker OR designer OR actor OR director site:imdb.com OR site:discogs.com OR site:behance.net OR site:spotify.com OR site:wikipedia.org OR site:allmusic.com`;
            
            console.log("Searching:", searchQuery);
            
            const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: searchQuery,
                limit: 8,
                scrapeOptions: { formats: ["markdown"] },
              }),
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              
              if (searchData.data && searchData.data.length > 0) {
                console.log(`Found ${searchData.data.length} results for ${name}`);
                
                // Combine content from multiple sources for richer data
                let combinedContent = "";
                let bestSourceUrl = "";
                const allUrls: string[] = [];
                
                for (const result of searchData.data.slice(0, 5)) {
                  if (result.url?.includes('linkedin.com')) continue;
                  
                  const content = result.markdown || result.description || '';
                  if (content.length > 50) {
                    combinedContent += `\n\n--- Source: ${result.url} ---\n${content}`;
                    allUrls.push(result.url);
                    
                    // Prefer Wikipedia, IMDb, Discogs, or Spotify as primary source
                    if (!bestSourceUrl) {
                      if (result.url?.includes('wikipedia.org') || 
                          result.url?.includes('imdb.com') ||
                          result.url?.includes('discogs.com') ||
                          result.url?.includes('spotify.com') ||
                          result.url?.includes('allmusic.com')) {
                        bestSourceUrl = result.url;
                      } else {
                        bestSourceUrl = result.url;
                      }
                    }
                  }
                }

                if (combinedContent.length > 100) {
                  // Use AI to extract comprehensive profile info
                  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: GEMINI_FLASH,
                      messages: [
                        {
                          role: "system",
                          content: `You are extracting professional profile information for "${name}".
Extract all available information including their bio, professional roles, location, skills, notable works/credits, and awards.
Only extract if the content is definitively about this specific person.
Be thorough - extract skills from their work history and credits.${PROMPT_INJECTION_DEFENSE_CLAUSE}`
                        },
                        {
                          role: "user",
                          content: `Extract comprehensive profile for "${name}" from these sources:\n\n${wrapUntrustedContent('scraped web search results', combinedContent.substring(0, 30000))}`
                        }
                      ],
                      tools: [
                        {
                          type: "function",
                          function: {
                            name: "extract_profile",
                            description: "Extract comprehensive profile information",
                            parameters: {
                              type: "object",
                              properties: {
                                name: { type: "string", description: "Full professional name" },
                                role: { type: "string", description: "Primary professional role(s), comma separated" },
                                bio: { type: "string", description: "Professional bio, 2-3 sentences" },
                                location: { type: "string", description: "City, Country or region" },
                                skills: { 
                                  type: "array", 
                                  items: { type: "string" },
                                  description: "List of professional skills (max 10)"
                                },
                                imageUrl: { type: "string", description: "Profile image URL if found" },
                                credits: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      project_name: { type: "string" },
                                      role: { type: "string" },
                                      year: { type: "number" }
                                    }
                                  },
                                  description: "Notable works, albums, films, projects (max 10)"
                                },
                                awards: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      title: { type: "string" },
                                      organization: { type: "string" },
                                      year: { type: "number" },
                                      category: { type: "string" }
                                    }
                                  },
                                  description: "Awards and nominations (max 10)"
                                },
                                isMatch: { type: "boolean", description: "True if this content is about the searched person" }
                              },
                              required: ["name", "role", "isMatch"]
                            }
                          }
                        }
                      ],
                      tool_choice: { type: "function", function: { name: "extract_profile" } }
                    }),
                  });

                  if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                    
                    if (toolCall) {
                      try {
                        const extracted = JSON.parse(toolCall.function.arguments);
                        
                        if (extracted.isMatch && extracted.name) {
                          console.log(`AI extracted profile for ${name}: ${extracted.role}`);
                          
                          const profile: EnrichedProfile = {
                            name: extracted.name,
                            role: extracted.role || contact.role || 'Creative Professional',
                            bio: extracted.bio,
                            location: extracted.location,
                            skills: extracted.skills?.slice(0, 10),
                            imageUrl: extracted.imageUrl,
                            sourceUrl: bestSourceUrl,
                            status: 'found',
                            credits: extracted.credits?.length || 0,
                            awards: extracted.awards?.length || 0
                          };

                          // If importing directly, create the profile with all data
                          if (importDirectly) {
                            // Create the unclaimed profile
                            const { data: profileId, error } = await supabase.rpc('create_unclaimed_profile', {
                              p_full_name: profile.name,
                              p_role: profile.role,
                              p_bio: profile.bio || null,
                              p_location: profile.location || null,
                              p_avatar_url: profile.imageUrl || null,
                              p_professional_skills: profile.skills ? JSON.stringify(profile.skills.map(s => ({ skill: s, level: 'professional' }))) : '[]',
                              p_imported_from_url: profile.sourceUrl || null,
                              p_source: 'bulk_import_enriched'
                            });

                            if (!error && profileId) {
                              importedCount++;
                              
                              // Insert credits if extracted
                              if (extracted.credits && extracted.credits.length > 0) {
                                for (const credit of extracted.credits.slice(0, 10)) {
                                  await supabase.from('credits').insert({
                                    user_id: profileId,
                                    project_name: credit.project_name,
                                    role: credit.role || profile.role,
                                    year: credit.year || null,
                                    verification_status: 'imported'
                                  });
                                }
                              }
                              
                              // Insert awards if extracted
                              if (extracted.awards && extracted.awards.length > 0) {
                                for (const award of extracted.awards.slice(0, 10)) {
                                  await supabase.from('awards').insert({
                                    user_id: profileId,
                                    title: award.title,
                                    organization: award.organization || 'Unknown',
                                    year: award.year || null,
                                    category: award.category || null,
                                    verification_status: 'imported'
                                  });
                                }
                              }
                            }
                          }

                          return profile;
                        }
                      } catch (parseError) {
                        console.error("Error parsing AI response:", parseError);
                      }
                    }
                  } else {
                    console.error("AI response error:", await aiResponse.text());
                  }
                }
              }
            }
          } catch (e) {
            console.error("Search error for", name, e);
          }
        }

        // Fallback: create basic profile from provided data
        console.log(`Creating basic profile for ${name} (no web data found)`);
        
        const profile: EnrichedProfile = {
          name: name,
          role: contact.role || 'Creative Professional',
          status: 'not_found'
        };

        // If importing directly even without enrichment
        if (importDirectly) {
          const { error } = await supabase.rpc('create_unclaimed_profile', {
            p_full_name: profile.name,
            p_role: profile.role,
            p_source: 'bulk_import_basic'
          });

          if (!error) {
            profile.status = 'found';
            importedCount++;
          }
        }

        return profile;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches to avoid rate limits
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const foundCount = results.filter(r => r.status === 'found').length;
    const notFoundCount = results.filter(r => r.status === 'not_found').length;

    console.log(`Complete: ${foundCount} found, ${notFoundCount} not found, ${importedCount} imported`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: contacts.length,
          found: foundCount,
          notFound: notFoundCount,
          imported: importedCount
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Bulk import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bulk import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});