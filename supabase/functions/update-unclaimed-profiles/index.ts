import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdminOrCron } from "../_shared/admin-guard.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UnclaimedProfile {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  imported_from_url: string | null;
  imported_data: any;
}

async function generateBioWithAI(profile: UnclaimedProfile): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.log('No Lovable API key, using template bio');
    return generateTemplateBio(profile);
  }

  try {
    const prompt = `Generate a professional, engaging bio (60-100 words) for a creative professional profile. 
    Use this information:
    - Name: ${profile.full_name}
    - Role: ${profile.role}
    - Location: ${profile.location || 'Unknown'}
    - Source: ${profile.imported_from_url || 'Unknown'}
    
    Make it sound authentic and professional. Focus on their creative work and expertise.
    Do NOT include any markdown, quotes, or special formatting. Just plain text.
    Do NOT start with their name - write in third person.`;

    const response = await fetch('https://api.lovable.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI bio generation failed:', await response.text());
      return generateTemplateBio(profile);
    }

    const data = await response.json();
    const generatedBio = data.choices?.[0]?.message?.content?.trim();
    
    if (generatedBio && generatedBio.length >= 20) {
      return generatedBio;
    }
  } catch (error) {
    console.error('Error generating AI bio:', error);
  }

  return generateTemplateBio(profile);
}

function generateTemplateBio(profile: UnclaimedProfile): string {
  const location = profile.location ? ` based in ${profile.location}` : '';
  const role = profile.role || 'Creative Professional';
  
  const templates = [
    `Award-winning ${role}${location} with a passion for pushing creative boundaries. Known for innovative work and collaborative spirit in the industry.`,
    `Experienced ${role}${location} bringing unique vision and expertise to every project. Dedicated to excellence and creative innovation.`,
    `Talented ${role}${location} with a distinctive creative voice. Combines technical skill with artistic vision to deliver exceptional work.`,
    `Accomplished ${role}${location} recognized for outstanding contributions to the creative industry. Open to meaningful collaborations.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

async function fetchAvatarFromUrl(url: string): Promise<string | null> {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey || !url) return null;

  try {
    console.log('Fetching avatar from:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl failed:', response.status);
      return null;
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';

    // Extract profile image from common patterns
    const imagePatterns = [
      // IMDb profile images
      /class="[^"]*ipc-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]+class="[^"]*profile[^"]*"[^>]+src="([^"]+)"/i,
      // Spotify
      /<img[^>]+data-testid="[^"]*image[^"]*"[^>]+src="([^"]+)"/i,
      // Generic profile/avatar images
      /property="og:image"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i,
      // SoundCloud
      /<img[^>]+class="[^"]*sc-artwork[^"]*"[^>]+src="([^"]+)"/i,
      // YouTube
      /yt-img-shadow[^>]+src="([^"]+)"/i,
      // Behance/Dribbble
      /<img[^>]+class="[^"]*avatar[^"]*"[^>]+src="([^"]+)"/i,
      // General large images that might be profile pics
      /<img[^>]+src="(https:\/\/[^"]+(?:profile|avatar|photo|image)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
    ];

    for (const pattern of imagePatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const imageUrl = match[1];
        // Filter out small icons, placeholders
        if (!imageUrl.includes('placeholder') && 
            !imageUrl.includes('default') &&
            !imageUrl.includes('1x1') &&
            imageUrl.startsWith('http')) {
          console.log('Found avatar:', imageUrl.substring(0, 100));
          return imageUrl;
        }
      }
    }

    console.log('No avatar found in page');
    return null;
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { limit = 50, onlyMissingBio = false, onlyMissingAvatar = false } = await req.json().catch(() => ({}));

    console.log('Updating unclaimed profiles, limit:', limit, 'onlyMissingBio:', onlyMissingBio, 'onlyMissingAvatar:', onlyMissingAvatar);

    // Get unclaimed profiles that need updates
    let query = supabase
      .from('profiles')
      .select('user_id, full_name, role, bio, avatar_url, location, imported_from_url, imported_data')
      .eq('is_claimed', false)
      .limit(limit);

    if (onlyMissingBio) {
      query = query.or('bio.is.null,bio.eq.');
    }
    if (onlyMissingAvatar) {
      query = query.or('avatar_url.is.null,avatar_url.eq.');
    }

    const { data: profiles, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${profiles?.length || 0} profiles to update`);

    const results = {
      total: profiles?.length || 0,
      biosGenerated: 0,
      avatarsFetched: 0,
      errors: 0,
    };

    for (const profile of profiles || []) {
      const updates: Record<string, any> = {};

      // Generate bio if missing or too short
      if (!profile.bio || profile.bio.length < 20) {
        console.log(`Generating bio for: ${profile.full_name}`);
        const newBio = await generateBioWithAI(profile);
        if (newBio) {
          updates.bio = newBio;
          results.biosGenerated++;
        }
      }

      // Fetch avatar if missing
      if (!profile.avatar_url && profile.imported_from_url) {
        console.log(`Fetching avatar for: ${profile.full_name}`);
        const avatarUrl = await fetchAvatarFromUrl(profile.imported_from_url);
        if (avatarUrl) {
          updates.avatar_url = avatarUrl;
          results.avatarsFetched++;
        }
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('user_id', profile.user_id);

        if (updateError) {
          console.error(`Error updating ${profile.full_name}:`, updateError);
          results.errors++;
        } else {
          console.log(`Updated ${profile.full_name}:`, Object.keys(updates).join(', '));
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('Update complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating profiles:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
