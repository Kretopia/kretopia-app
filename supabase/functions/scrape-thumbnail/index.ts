import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ThriveIN/1.0; +https://thrivein.io)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Try og:image first
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1];
    
    // Try twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch?.[1]) return twMatch[1];
    
    // Try first large image in the page
    const imgMatches = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*/gi);
    if (imgMatches) {
      for (const img of imgMatches.slice(0, 10)) {
        const srcMatch = img.match(/src=["']([^"']+)["']/i);
        if (srcMatch?.[1] && !srcMatch[1].includes('icon') && !srcMatch[1].includes('logo') && !srcMatch[1].includes('avatar') && !srcMatch[1].includes('.svg')) {
          return srcMatch[1];
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { credit_id, project_name, url, project_type } = await req.json();

    // Strategy 1: If URL provided, scrape og:image directly
    if (url) {
      const ogImage = await extractOgImage(url);
      if (ogImage) {
        // Persist if credit_id provided
        if (credit_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await supabase.from('credits').update({ thumbnail_url: ogImage }).eq('id', credit_id);
        }
        return new Response(JSON.stringify({ image_url: ogImage, source: 'og_scrape' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Strategy 2: Use AI to find the most likely image URL for this production
    if (project_name) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ image_url: null, error: 'No API key' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const typeHint = project_type || 'creative project';
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You find official poster, cover art, or promotional image URLs for creative works. Return ONLY a JSON object with "image_url" (a direct URL to a real, publicly accessible image - prefer Wikipedia, TMDB, MusicBrainz cover art archive, or official sources) and "search_url" (a URL to search for this project on Google Images). If you cannot find a real image URL, set image_url to null.',
            },
            {
              role: 'user',
              content: `Find the official poster or cover image for: "${project_name}" (${typeHint}). Return JSON only.`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = aiData.choices?.[0]?.message?.content || '{}';
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch { /* ignore */ }

        let imageUrl = parsed.image_url || null;

        // Validate the URL actually returns an image
        if (imageUrl) {
          try {
            const check = await fetch(imageUrl, { method: 'HEAD', redirect: 'follow' });
            const ct = check.headers.get('content-type') || '';
            if (!ct.startsWith('image/') && !check.ok) {
              imageUrl = null;
            }
          } catch {
            imageUrl = null;
          }
        }

        // If we got a valid image and have a credit_id, persist it
        if (imageUrl && credit_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await supabase.from('credits').update({ thumbnail_url: imageUrl }).eq('id', credit_id);
        }

        return new Response(JSON.stringify({
          image_url: imageUrl,
          search_url: parsed.search_url || null,
          source: 'ai_lookup',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ image_url: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('scrape-thumbnail error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
