import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OdosMember {
  name: string;
  role: string;
  avatarUrl?: string;
  profileUrl?: string;
  instagramUrl?: string;
}

interface ImportResult {
  name: string;
  status: 'imported' | 'enriched' | 'duplicate' | 'error';
  profileId?: string;
  credits?: number;
  awards?: number;
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting ODOS members import...");

    // Step 1: Scrape the ODOS members page
    const odosUrl = "https://getodos.com/members/";
    console.log("Scraping ODOS members page:", odosUrl);

    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: odosUrl,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error("Firecrawl scrape error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to scrape ODOS page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || "";
    const markdown = scrapeData.data?.markdown || "";

    console.log("Scraped content length:", markdown.length);

    // Step 2: Use AI to extract member data from the page
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Using AI to extract member data...");

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are extracting member data from the ODOS creative community website. 
Extract all members with their names, professional roles, and any links you can find.
The page structure shows member cards with name, role, profile image URLs, and Instagram links.`
          },
          {
            role: "user",
            content: `Extract all members from this ODOS members page. Look for patterns like:
- Names (in headings)
- Roles (like Actor, Director, Producer, etc.)
- Image URLs (from img src or background-image)
- Profile URLs (links to individual member pages)
- Instagram URLs (follow links)

Content:\n\n${markdown.substring(0, 50000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_members",
              description: "Extract all ODOS members from the page",
              parameters: {
                type: "object",
                properties: {
                  members: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Full name of the member" },
                        role: { type: "string", description: "Professional role(s)" },
                        avatarUrl: { type: "string", description: "Profile image URL" },
                        profileUrl: { type: "string", description: "Link to member's ODOS profile page" },
                        instagramUrl: { type: "string", description: "Instagram profile URL" }
                      },
                      required: ["name", "role"]
                    }
                  }
                },
                required: ["members"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_members" } }
      }),
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("AI extraction error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to extract member data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractData = await extractResponse.json();
    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "No member data extracted" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { members } = JSON.parse(toolCall.function.arguments) as { members: OdosMember[] };
    console.log(`Extracted ${members.length} members from ODOS page`);

    // Step 3: Process each member - check duplicates, enrich with AI, create profiles
    const results: ImportResult[] = [];
    let importedCount = 0;
    let enrichedCount = 0;
    let duplicateCount = 0;

    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (member): Promise<ImportResult> => {
        const name = member.name?.trim();
        if (!name || name.length < 2) {
          return { name: name || 'Unknown', status: 'error', message: 'Invalid name' };
        }

        console.log(`Processing ODOS member: ${name}`);

        // Check for existing profile by name
        const { data: existing } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .ilike('full_name', name)
          .limit(1)
          .single();

        if (existing) {
          console.log(`Duplicate found: ${name}`);
          duplicateCount++;
          
          // Update existing profile with ODOS badge
          await supabase
            .from('profiles')
            .update({ badge: 'odos' })
            .eq('user_id', existing.user_id);
          
          return { 
            name, 
            status: 'duplicate', 
            profileId: existing.user_id,
            message: 'Profile exists, badge updated to ODOS'
          };
        }

        // Try to enrich with additional data from web search
        let bio: string | undefined;
        let location: string | undefined;
        let skills: string[] = [];
        let credits: { project_name: string; role: string; year?: number }[] = [];
        let awards: { title: string; organization: string; year?: number; category?: string }[] = [];
        let enrichedImageUrl = member.avatarUrl;
        let sourceUrl = member.profileUrl;

        if (FIRECRAWL_API_KEY && LOVABLE_API_KEY) {
          try {
            // Search for this person's professional profile
            const searchQuery = `"${name}" ${member.role} creative artist actor director producer musician site:imdb.com OR site:discogs.com OR site:spotify.com OR site:wikipedia.org OR site:allmusic.com`;
            
            console.log(`Enriching: ${name}`);

            const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: searchQuery,
                limit: 5,
                scrapeOptions: { formats: ["markdown"] },
              }),
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              
              if (searchData.data && searchData.data.length > 0) {
                let combinedContent = "";
                
                for (const result of searchData.data.slice(0, 3)) {
                  if (result.url?.includes('linkedin.com')) continue;
                  const content = result.markdown || result.description || '';
                  if (content.length > 50) {
                    combinedContent += `\n\n--- Source: ${result.url} ---\n${content}`;
                    if (!sourceUrl && (result.url?.includes('wikipedia.org') || result.url?.includes('imdb.com'))) {
                      sourceUrl = result.url;
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
                          content: `You are extracting professional profile information for "${name}" who is a ${member.role}. 
Extract their bio, location, skills, notable works/credits, and awards. Only extract if content is definitively about this person.`
                        },
                        {
                          role: "user",
                          content: `Extract profile for "${name}" (${member.role}):\n\n${combinedContent.substring(0, 25000)}`
                        }
                      ],
                      tools: [
                        {
                          type: "function",
                          function: {
                            name: "extract_profile",
                            description: "Extract profile information",
                            parameters: {
                              type: "object",
                              properties: {
                                bio: { type: "string", description: "Professional bio, 2-3 sentences" },
                                location: { type: "string", description: "City, Country" },
                                skills: { 
                                  type: "array", 
                                  items: { type: "string" },
                                  description: "Professional skills (max 8)"
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
                                  description: "Notable works (max 8)"
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
                                  description: "Awards and nominations (max 8)"
                                },
                                isMatch: { type: "boolean", description: "True if content is about this person" }
                              },
                              required: ["isMatch"]
                            }
                          }
                        }
                      ],
                      tool_choice: { type: "function", function: { name: "extract_profile" } }
                    }),
                  });

                  if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const aiToolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                    
                    if (aiToolCall) {
                      try {
                        const extracted = JSON.parse(aiToolCall.function.arguments);
                        
                        if (extracted.isMatch) {
                          bio = extracted.bio;
                          location = extracted.location;
                          skills = extracted.skills?.slice(0, 8) || [];
                          credits = extracted.credits?.slice(0, 8) || [];
                          awards = extracted.awards?.slice(0, 8) || [];
                          if (extracted.imageUrl && !enrichedImageUrl) {
                            enrichedImageUrl = extracted.imageUrl;
                          }
                          console.log(`Enriched ${name}: ${credits.length} credits, ${awards.length} awards`);
                        }
                      } catch (e) {
                        console.error("Error parsing enrichment:", e);
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("Enrichment error for", name, e);
          }
        }

        // Create the unclaimed profile with ODOS badge
        const { data: profileId, error: createError } = await supabase.rpc('create_unclaimed_profile', {
          p_full_name: name,
          p_role: member.role || 'Creative Professional',
          p_bio: bio || null,
          p_location: location || null,
          p_avatar_url: enrichedImageUrl || null,
          p_professional_skills: skills.length > 0 ? JSON.stringify(skills.map(s => ({ skill: s, level: 'professional' }))) : '[]',
          p_imported_from_url: sourceUrl || member.profileUrl || null,
          p_source: 'odos_import'
        });

        if (createError || !profileId) {
          console.error("Error creating profile for", name, createError);
          return { name, status: 'error', message: createError?.message || 'Failed to create profile' };
        }

        // Set ODOS badge
        await supabase
          .from('profiles')
          .update({ badge: 'odos' })
          .eq('user_id', profileId);

        // Insert credits
        if (credits.length > 0) {
          for (const credit of credits) {
            await supabase.from('credits').insert({
              user_id: profileId,
              project_name: credit.project_name,
              role: credit.role || member.role,
              year: credit.year || null,
              verification_status: 'imported'
            });
          }
        }

        // Insert awards
        if (awards.length > 0) {
          for (const award of awards) {
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

        importedCount++;
        if (credits.length > 0 || awards.length > 0) {
          enrichedCount++;
        }

        return {
          name,
          status: credits.length > 0 || awards.length > 0 ? 'enriched' : 'imported',
          profileId,
          credits: credits.length,
          awards: awards.length
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < members.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`ODOS import complete: ${importedCount} imported, ${enrichedCount} enriched, ${duplicateCount} duplicates`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          totalMembers: members.length,
          imported: importedCount,
          enriched: enrichedCount,
          duplicates: duplicateCount,
          errors: results.filter(r => r.status === 'error').length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ODOS import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "ODOS import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
