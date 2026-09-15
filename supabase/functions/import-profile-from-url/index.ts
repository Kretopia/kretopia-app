import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing URL:', url);

    // Create Supabase client early for deduplication check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this URL was already imported (deduplication)
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('imported_from_url', url)
      .maybeSingle();

    if (existingProfile) {
      console.log('Profile already exists for this URL:', existingProfile.full_name);
      return new Response(
        JSON.stringify({ 
          error: `This URL has already been imported. Profile "${existingProfile.full_name}" exists.`,
          existing_profile_id: existingProfile.user_id,
          existing_profile_name: existingProfile.full_name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Determine the source type
    const urlLower = url.toLowerCase();
    let sourceType = 'website';
    
    if (urlLower.includes('imdb.com')) {
      sourceType = 'imdb';
    } else if (urlLower.includes('discogs.com')) {
      sourceType = 'discogs';
    } else if (urlLower.includes('allmusic.com')) {
      sourceType = 'allmusic';
    } else if (urlLower.includes('spotify.com') || urlLower.includes('artists.spotify.com')) {
      sourceType = 'spotify';
    } else if (urlLower.includes('soundcloud.com')) {
      sourceType = 'soundcloud';
    } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      sourceType = 'youtube';
    } else if (urlLower.includes('behance.net')) {
      sourceType = 'behance';
    } else if (urlLower.includes('dribbble.com')) {
      sourceType = 'dribbble';
    } else if (urlLower.includes('artstation.com')) {
      sourceType = 'artstation';
    } else if (urlLower.includes('wikipedia.org')) {
      sourceType = 'wikipedia';
    } else if (urlLower.includes('linkedin.com')) {
      return new Response(
        JSON.stringify({ error: 'LinkedIn profiles cannot be imported due to restrictions. Try IMDB, Spotify, Discogs, Behance, or other platforms.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use Firecrawl to fetch the page content
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let content = '';
    let pageTitle = '';
    let pageDescription = '';
    let imageUrl = '';
    let wikipediaContent = '';
    
    // Helper function to scrape with Firecrawl
    const scrapeWithFirecrawl = async (scrapeUrl: string): Promise<{ content: string; title: string; description: string; image: string }> => {
      if (!FIRECRAWL_API_KEY) return { content: '', title: '', description: '', image: '' };
      
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: scrapeUrl,
            formats: ['markdown'],
            onlyMainContent: false,
            waitFor: 5000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            content: data.data?.markdown || '',
            title: data.data?.metadata?.title || '',
            description: data.data?.metadata?.description || '',
            image: data.data?.metadata?.ogImage || ''
          };
        }
        console.log('Firecrawl failed for', scrapeUrl, ':', response.status);
      } catch (e) {
        console.error('Firecrawl error for', scrapeUrl, ':', e);
      }
      return { content: '', title: '', description: '', image: '' };
    };
    
    // Try Firecrawl first (best for JS-rendered pages)
    if (FIRECRAWL_API_KEY) {
      console.log('Using Firecrawl to scrape URL...');
      const result = await scrapeWithFirecrawl(url);
      content = result.content;
      pageTitle = result.title;
      pageDescription = result.description;
      imageUrl = result.image;
      console.log('Firecrawl success, content length:', content.length);
    }

    // Fallback to direct fetch
    if (!content || content.length < 100) {
      console.log('Fallback: direct fetch...');
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });

        if (response.ok) {
          content = await response.text();
          console.log('Direct fetch success, content length:', content.length);
        }
      } catch (e) {
        console.error('Direct fetch error:', e);
      }
    }

    if (!content || content.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Could not retrieve content from this URL. The page may be protected, require login, or block automated access. Try a different URL or platform.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Try to find and scrape Wikipedia for additional awards/recognition data
    if (FIRECRAWL_API_KEY && sourceType !== 'wikipedia') {
      // Extract name from page title or content to search Wikipedia
      const nameMatch = pageTitle?.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
      const possibleName = nameMatch?.[1] || pageTitle?.split(/[|\-–]/)?.[0]?.trim();
      
      if (possibleName && possibleName.length > 3 && possibleName.length < 50) {
        console.log('Searching Wikipedia for:', possibleName);
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(possibleName.replace(/\s+/g, '_'))}`;
        
        const wikiResult = await scrapeWithFirecrawl(wikiUrl);
        if (wikiResult.content && wikiResult.content.length > 500) {
          // Check if it's actually about the right person (contains relevant keywords)
          const lowerContent = wikiResult.content.toLowerCase();
          const relevantKeywords = ['singer', 'songwriter', 'producer', 'musician', 'actor', 'director', 'artist', 'composer', 'grammy', 'award', 'album', 'film'];
          const isRelevant = relevantKeywords.some(kw => lowerContent.includes(kw));
          
          if (isRelevant) {
            wikipediaContent = wikiResult.content;
            console.log('Wikipedia content found, length:', wikipediaContent.length);
          } else {
            console.log('Wikipedia page found but not relevant to creative professional');
          }
        }
      }
    }
    
    // Use Lovable AI to extract RICH profile information
    console.log('Calling AI for profile extraction...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting comprehensive professional profile information from web pages about creative professionals.

YOUR GOAL: Extract as much relevant professional information as possible to build a rich creator profile.

Focus on: musicians, producers, songwriters, filmmakers, directors, designers, artists, actors, photographers, videographers, content creators, etc.

IMPORTANT EXTRACTION RULES:
1. For SKILLS: Infer skills from their work, credits, and description. A songwriter would have skills like "Songwriting", "Lyric Writing", "Music Composition", "Collaboration". A producer would have "Music Production", "Beat Making", "Mixing", etc.
2. For CREDITS: Extract ALL work credits you can find - albums, songs, films, projects, etc. Include the artist they worked with in the project name.
3. For BIO: Create a compelling professional bio that highlights their achievements, notable collaborations, and career highlights.
4. For AWARDS: Look for Grammy nominations/wins, Oscar nominations/wins, Billboard awards, certifications (Platinum, Gold), or any industry recognition.
5. For PRESS: Look for any media coverage, interviews, articles, news mentions.
6. For SOCIAL LINKS: Look for any social media links, website links, or platform links.
7. For LOCATION: If not explicitly stated, try to infer from context or leave empty.

Skip company pages, product pages, or generic content - we only want individual professional profiles.`
          },
          {
            role: 'user',
            content: `Extract a COMPREHENSIVE profile from this ${sourceType} page. Get as much data as possible for a rich creator profile.

IMPORTANT FOR AWARDS: Look very carefully for:
- Grammy Awards (wins AND nominations) - including categories like "Songwriter of the Year", "Album of the Year", "Song of the Year", etc.
- Oscar/Academy Awards (wins and nominations)
- Billboard Music Awards
- MTV Awards
- Emmy Awards
- BRIT Awards
- American Music Awards
- Gold/Platinum certifications
- ANY industry awards or nominations

For each award, capture: title, organization, year, category, and whether it was a WIN or NOMINATION.

URL: ${url}
Title: ${pageTitle}
Description: ${pageDescription}

Page Content:
${content.substring(0, 25000)}

${wikipediaContent ? `
--- ADDITIONAL WIKIPEDIA DATA (use this for awards, biography, and career details) ---
${wikipediaContent.substring(0, 15000)}
` : ''}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract comprehensive professional profile information from web content",
              parameters: {
                type: "object",
                properties: {
                  full_name: { 
                    type: "string", 
                    description: "The person's full name" 
                  },
                  role: { 
                    type: "string", 
                    description: "Their primary profession/role (e.g., Producer, Director, Artist, Musician, Songwriter, Designer, Photographer)" 
                  },
                  bio: { 
                    type: "string", 
                    description: "A compelling professional bio highlighting achievements, notable collaborations, and career highlights (200-500 characters)" 
                  },
                  location: { 
                    type: "string", 
                    description: "Their location if available (city, country)" 
                  },
                  avatar_url: { 
                    type: "string", 
                    description: "URL to their profile/avatar image if found" 
                  },
                  skills: { 
                    type: "array", 
                    items: { 
                      type: "object",
                      properties: {
                        skill: { type: "string", description: "The skill name (e.g., Songwriting, Music Production)" },
                        level: { type: "number", description: "Skill level from 1-5, infer from their experience (5 for experts, 4 for advanced, 3 for proficient)" },
                        category: { type: "string", description: "Category like 'Audio & Music', 'Video & Film', 'Design', 'Content & Social', 'Photography & Visual'" }
                      },
                      required: ["skill", "level", "category"]
                    }, 
                    description: "List of professional skills with levels (5-15 skills). Categories: Audio & Music, Video & Film, Design, Photography & Visual, Content & Social, Technical, Creative Direction, Motion & Animation" 
                  },
                  awards: { 
                    type: "array", 
                    items: { 
                      type: "object", 
                      properties: { 
                        title: { type: "string", description: "Award name (e.g., 'Songwriter of the Year', 'Best Pop Vocal Album')" }, 
                        organization: { type: "string", description: "Awarding organization (Grammy Awards, Academy Awards, Billboard, etc.)" }, 
                        year: { type: "number", description: "Year received or nominated" },
                        category: { type: "string", description: "Award category (e.g., 'Non-Classical', 'Pop')" },
                        status: { type: "string", enum: ["won", "nominated"], description: "Whether they won or were nominated" },
                        description: { type: "string", description: "Brief context like 'For work on XYZ album' or the song/project name" }
                      },
                      required: ["title", "organization"]
                    }, 
                    description: "ALL awards AND nominations. Include Grammy wins, Grammy nominations, Oscar nominations, certifications, etc. Get as many as possible (up to 30)." 
                  },
                  credits: { 
                    type: "array", 
                    items: { 
                      type: "object", 
                      properties: { 
                        project_name: { type: "string", description: "Project/Song/Album/Film name - include artist name if applicable (e.g., 'Locked Away - R. City ft. Adam Levine')" }, 
                        role: { type: "string", description: "Their role on the project (Songwriter, Producer, Director, etc.)" }, 
                        year: { type: "number", description: "Year of release" }
                      },
                      required: ["project_name", "role"]
                    }, 
                    description: "Work credits - albums, songs, films, projects they've worked on. Include as many as possible (up to 20)." 
                  },
                  press_links: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Article/interview title" },
                        publication: { type: "string", description: "Publication name (e.g., Rolling Stone, Billboard, Variety)" },
                        url: { type: "string", description: "URL to the article if available" },
                        date: { type: "string", description: "Publication date if known (YYYY-MM-DD or year)" }
                      },
                      required: ["title", "publication"]
                    },
                    description: "Press coverage, interviews, articles, news mentions"
                  },
                  social_links: { 
                    type: "object", 
                    properties: { 
                      twitter: { type: "string" }, 
                      instagram: { type: "string" }, 
                      website: { type: "string" }, 
                      youtube: { type: "string" }, 
                      spotify: { type: "string" },
                      soundcloud: { type: "string" },
                      facebook: { type: "string" },
                      tiktok: { type: "string" },
                      linkedin: { type: "string" }
                    }, 
                    description: "Social media and platform links" 
                  },
                  notable_collaborations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Names of notable artists/people they've worked with"
                  },
                  genres: {
                    type: "array",
                    items: { type: "string" },
                    description: "Music genres or creative styles they work in"
                  },
                  is_valid_profile: { 
                    type: "boolean", 
                    description: "True if this is a valid individual creator profile, false for companies/products/generic pages" 
                  }
                },
                required: ["full_name", "role", "is_valid_profile", "bio", "skills", "credits"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI extraction failed. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No tool call in AI response:', JSON.stringify(aiResult));
      return new Response(
        JSON.stringify({ error: 'AI could not extract profile data from this page. Try a more specific profile URL.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let profileData;
    try {
      profileData = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse AI response:', toolCall.function.arguments);
      return new Response(
        JSON.stringify({ error: 'Failed to parse profile data. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Extracted profile:', profileData.full_name, '- Valid:', profileData.is_valid_profile);
    console.log('Skills extracted:', profileData.skills?.length || 0);
    console.log('Credits extracted:', profileData.credits?.length || 0);

    if (!profileData.is_valid_profile) {
      return new Response(
        JSON.stringify({ error: 'This page does not appear to be an individual creator profile. Please provide a direct profile URL for a person (not a company or product page).' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!profileData.full_name || profileData.full_name.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Could not extract a valid name from this page.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Also check for duplicate by name + similar role (fuzzy deduplication)
    const { data: nameMatch } = await supabase
      .from('profiles')
      .select('user_id, full_name, role')
      .ilike('full_name', profileData.full_name)
      .eq('is_claimed', false)
      .maybeSingle();

    if (nameMatch) {
      console.log('Found existing unclaimed profile with same name:', nameMatch.full_name);
      // Instead of creating new, could update existing - for now just warn
      return new Response(
        JSON.stringify({ 
          error: `An unclaimed profile for "${profileData.full_name}" already exists. Consider updating the existing profile instead.`,
          existing_profile_id: nameMatch.user_id,
          existing_profile_name: nameMatch.full_name
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Use the image from extraction or from page metadata
    const finalAvatarUrl = profileData.avatar_url || imageUrl || null;

    // Ensure skills is an array
    const skills = Array.isArray(profileData.skills) ? profileData.skills : [];

    // Create the unclaimed profile
    console.log('Creating unclaimed profile with', skills.length, 'skills...');
    const { data: newProfileId, error: createError } = await supabase.rpc('create_unclaimed_profile', {
      p_full_name: profileData.full_name,
      p_role: profileData.role || 'Creative Professional',
      p_bio: profileData.bio || `${profileData.full_name} is a ${profileData.role || 'creative professional'}.`,
      p_avatar_url: finalAvatarUrl,
      p_location: profileData.location || null,
      p_professional_skills: skills,
      p_imported_data: {
        ...profileData,
        source_url: url,
        source_type: sourceType,
        imported_at: new Date().toISOString()
      },
      p_imported_from_url: url,
      p_source: `imported_${sourceType}`
    });

    if (createError) {
      console.error('Error creating profile:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create profile: ' + createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Profile created with ID:', newProfileId);

    // Add credits if we have them
    const creditsAdded: string[] = [];
    if (profileData.credits && Array.isArray(profileData.credits) && profileData.credits.length > 0) {
      console.log('Adding', profileData.credits.length, 'credits...');
      for (const credit of profileData.credits.slice(0, 20)) {
        const projectName = credit.project_name || credit.project || (typeof credit === 'string' ? credit : null);
        if (!projectName) continue;
        
        const { error: creditError } = await supabase.from('credits').insert({
          user_id: newProfileId,
          project_name: projectName,
          role: credit.role || profileData.role || 'Creative',
          year: credit.year || null,
          verification_status: 'imported'
        });
        
        if (creditError) {
          console.error('Error adding credit:', creditError.message);
        } else {
          creditsAdded.push(projectName);
        }
      }
      console.log('Successfully added', creditsAdded.length, 'credits');
    }

    // Add awards if we have them (now supports up to 30)
    const awardsAdded: string[] = [];
    if (profileData.awards && Array.isArray(profileData.awards) && profileData.awards.length > 0) {
      console.log('Adding', profileData.awards.length, 'awards...');
      for (const award of profileData.awards.slice(0, 30)) {
        // Build description with status (won/nominated)
        let fullDescription = award.description || '';
        if (award.status === 'nominated' && !fullDescription.toLowerCase().includes('nominat')) {
          fullDescription = `Nominated${fullDescription ? ': ' + fullDescription : ''}`;
        } else if (award.status === 'won' && !fullDescription.toLowerCase().includes('won') && !fullDescription.toLowerCase().includes('winner')) {
          fullDescription = `Winner${fullDescription ? ': ' + fullDescription : ''}`;
        }
        
        const { error: awardError } = await supabase.from('awards').insert({
          user_id: newProfileId,
          title: award.title || (typeof award === 'string' ? award : 'Award'),
          organization: award.organization || 'Unknown',
          year: award.year || null,
          category: award.category || null,
          description: fullDescription || null,
          verification_status: 'imported'
        });
        
        if (awardError) {
          console.error('Error adding award:', awardError.message);
        } else {
          awardsAdded.push(award.title);
        }
      }
      console.log('Successfully added', awardsAdded.length, 'awards');
    }

    // Add press links if we have them
    const pressAdded: string[] = [];
    if (profileData.press_links && Array.isArray(profileData.press_links) && profileData.press_links.length > 0) {
      console.log('Adding', profileData.press_links.length, 'press links...');
      for (const press of profileData.press_links.slice(0, 15)) {
        const { error: pressError } = await supabase.from('press_links').insert({
          user_id: newProfileId,
          title: press.title || 'Press Coverage',
          publication: press.publication || 'Unknown',
          url: press.url || null,
          published_date: press.date ? (press.date.length === 4 ? `${press.date}-01-01` : press.date) : null,
          verification_status: 'imported'
        });
        
        if (pressError) {
          console.error('Error adding press link:', pressError.message);
        } else {
          pressAdded.push(press.title);
        }
      }
      console.log('Successfully added', pressAdded.length, 'press links');
    }

    console.log('Import complete!');
    return new Response(
      JSON.stringify({ 
        success: true,
        profile_id: newProfileId,
        profile_name: profileData.full_name,
        source: sourceType,
        extracted_data: profileData,
        stats: {
          skills_count: skills.length,
          credits_added: creditsAdded.length,
          awards_added: awardsAdded.length,
          press_added: pressAdded.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to import profile';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
