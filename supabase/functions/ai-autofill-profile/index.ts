import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function firecrawlSearch(query: string, apiKey: string, limit = 5) {
  const res = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  return res.json();
}

async function firecrawlScrape(url: string, apiKey: string) {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  });
  return res.json();
}

async function aiExtract(prompt: string, systemPrompt: string, lovableKey: string) {
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GEMINI_FLASH,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, // Low temperature to minimize fabrication
    }),
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Requires any signed-in user (this is an onboarding/profile-edit
    // feature called by regular users, not an admin tool). Was
    // incorrectly guarded with requireAdminOrCron (admin-role or cron
    // secret only) since 2026-05-11 (commit 2ebb9171), which silently
    // 401/403'd every real onboarding caller for 4 months -- fixed here
    // alongside the unrelated cost-DoS finding for this same function
    // (it burns FIRECRAWL_API_KEY/LOVABLE_API_KEY budget) since both
    // are solved by the same real auth check.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    const { full_name, url, current_role } = await req.json();

    if (!full_name && !url) {
      return new Response(JSON.stringify({ error: 'full_name or url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let webContext = '';

    // If a URL is provided (LinkedIn, IMDb, portfolio), scrape it
    if (url && firecrawlKey) {
      try {
        const scrapeData = await firecrawlScrape(url, firecrawlKey);
        const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || '';
        if (markdown) {
          webContext += `\n\n--- Scraped from ${url} ---\n${markdown.slice(0, 3000)}`;
        }
      } catch (e) {
        console.error('Scrape failed:', e);
      }
    }

    // Search the web for the person
    if (full_name && firecrawlKey) {
      try {
        const searchResults = await firecrawlSearch(
          `"${full_name}" ${current_role || 'creative'} profile`,
          firecrawlKey, 5
        );
        for (const result of (searchResults?.data || []).slice(0, 4)) {
          webContext += `\n\n--- ${result.url} ---\nTitle: ${result.title}\nDescription: ${result.description || ''}`;
        }
      } catch (e) {
        console.error('Search failed:', e);
      }
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'AI not available' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If no web data found, return empty profile — do NOT fabricate
    if (!webContext || webContext.trim().length < 30) {
      console.log(`[ai-autofill] No web data found for ${full_name}, returning empty profile`);
      return new Response(JSON.stringify({ success: true, profile: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use AI to extract structured profile data
    const extracted = await aiExtract(
      `Person: ${full_name || 'Unknown'}\nURL provided: ${url || 'None'}\nCurrent role hint: ${current_role || 'None'}\n\n${wrapUntrustedContent('web data', webContext)}`,
      `You are a profile data extractor for a creative professional platform.

From the web data, extract ONLY information that is EXPLICITLY stated in the provided text.

Return a JSON object with these fields:
- "role": Their primary creative role — ONLY if explicitly stated in the text
- "bio": A concise 2-3 sentence professional bio based ONLY on facts from the text. Max 200 chars.
- "location": Their city/country — ONLY if explicitly mentioned in the text
- "skills": Array of 3-6 professional skills — ONLY skills explicitly mentioned or demonstrated in the text
- "job_title": Their job title — ONLY if explicitly stated
- "industry": Their industry — ONLY if clearly evident from the text
- "avatar_url": URL to their profile photo if found in the HTML/page. null if not found.
- "website": Their personal website URL if found. null if not found.

CRITICAL RULES:
- ONLY include data that appears EXPLICITLY in the web results
- If a field cannot be determined from the text, set it to null
- Do NOT fabricate, guess, or infer information
- Do NOT make up bios for people you can't find data about
- If you're unsure about ANY field, set it to null
- Return raw JSON only, no markdown fences${PROMPT_INJECTION_DEFENSE_CLAUSE}`,
      lovableKey
    );

    let profile: any = {};
    try {
      const cleaned = extracted.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      profile = JSON.parse(cleaned);
    } catch (e) {
      console.error('AI parse failed:', e, extracted);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Post-validation: strip any fields that look fabricated
    // If bio doesn't reference anything from the web context, remove it
    if (profile.bio && webContext.length > 30) {
      const bioWords = profile.bio.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const contextLower = webContext.toLowerCase();
      const matchingWords = bioWords.filter((w: string) => contextLower.includes(w));
      // If less than 30% of significant words appear in source, bio is likely fabricated
      if (bioWords.length > 0 && (matchingWords.length / bioWords.length) < 0.3) {
        console.log(`[ai-autofill] Bio failed validation — removing likely fabricated bio`);
        profile.bio = null;
      }
    }

    console.log(`[ai-autofill] Profile extracted for ${full_name}:`, profile);

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[ai-autofill] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
