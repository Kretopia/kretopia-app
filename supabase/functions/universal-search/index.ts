import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();

  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return JSON.parse(cleaned);
  }

  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    return JSON.parse(cleaned.slice(objStart, objEnd + 1));
  }

  throw new Error('No valid JSON found in AI response');
}

// This function uses the service-role key, which bypasses RLS entirely — so
// interpolating the raw search string into PostgREST .or() filter syntax let
// a caller inject filter operators (commas, parens, colons) to manipulate
// which rows match, well beyond the intended substring search. Quote the
// value the same way src/lib/postgrestFilter.ts does for client-side
// filters (this edge function runs on Deno and can't share that import).
function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeText(value: string | null | undefined) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildRelatedSearches(query: string) {
  return [
    `${query} creator`,
    `${query} credits`,
    `${query} youtube`,
    `${query} spotify`,
    `${query} instagram`,
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Query must be at least 2 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmedQuery = query.trim();
    const q = escapePostgrestValue(`%${trimmedQuery}%`);

    const [profilesRes, creditsRes, oppsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, role, location, professional_skills, verification_tier, average_rating, bio')
        .or(`full_name.ilike.${q},role.ilike.${q},location.ilike.${q}`)
        .eq('onboarding_completed', true)
        .limit(15),
      supabase
        .from('credits')
        .select('id, project_name, role, year, verification_status, credit_category, thumbnail_url, user_id, collaborator_user_ids, client_brand, platform, description')
        .or(`project_name.ilike.${q},role.ilike.${q},client_brand.ilike.${q}`)
        .order('year', { ascending: false })
        .limit(20),
      supabase
        .from('opportunities')
        .select('id, title, description, type, compensation, location, created_at, status')
        .eq('status', 'active')
        .or(`title.ilike.${q},description.ilike.${q}`)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const platformProfiles = profilesRes.data || [];
    const matchedCredits = creditsRes.data || [];
    const platformOpps = oppsRes.data || [];

    const projectNames = [...new Set(matchedCredits.map(c => c.project_name))];
    let allRelatedCredits: any[] = [];
    if (projectNames.length > 0) {
      const { data: siblings } = await supabase
        .from('credits')
        .select('id, project_name, role, year, verification_status, credit_category, thumbnail_url, user_id, collaborator_user_ids, client_brand, platform, description')
        .in('project_name', projectNames)
        .order('year', { ascending: false })
        .limit(100);
      allRelatedCredits = siblings || [];
    }

    const projectMap = new Map<string, any>();
    for (const credit of allRelatedCredits) {
      if (!projectMap.has(credit.project_name)) {
        const primary = matchedCredits.find(c => c.project_name === credit.project_name) || credit;
        projectMap.set(credit.project_name, {
          project_name: credit.project_name,
          year: primary.year,
          credit_category: primary.credit_category,
          thumbnail_url: primary.thumbnail_url,
          client_brand: primary.client_brand,
          platform: primary.platform,
          description: primary.description,
          verification_status: primary.verification_status,
          roles: [],
        });
      }
      projectMap.get(credit.project_name).roles.push({
        id: credit.id,
        role: credit.role,
        user_id: credit.user_id,
        verification_status: credit.verification_status,
      });
    }

    for (const credit of matchedCredits) {
      if (!projectMap.has(credit.project_name)) {
        projectMap.set(credit.project_name, {
          project_name: credit.project_name,
          year: credit.year,
          credit_category: credit.credit_category,
          thumbnail_url: credit.thumbnail_url,
          client_brand: credit.client_brand,
          platform: credit.platform,
          description: credit.description,
          verification_status: credit.verification_status,
          roles: [{
            id: credit.id,
            role: credit.role,
            user_id: credit.user_id,
            verification_status: credit.verification_status,
          }],
        });
      }
    }
    const platformCredits = Array.from(projectMap.values());

    const allRoleUserIds = new Set<string>();
    platformCredits.forEach(p => p.roles.forEach((r: any) => allRoleUserIds.add(r.user_id)));
    let roleProfiles: Record<string, { full_name: string; avatar_url: string | null }> = {};
    if (allRoleUserIds.size > 0) {
      const { data: rp } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', Array.from(allRoleUserIds).slice(0, 50));
      if (rp) {
        for (const p of rp) {
          roleProfiles[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }
    }

    platformCredits.forEach(p => {
      p.roles = p.roles.map((r: any) => ({
        ...r,
        full_name: roleProfiles[r.user_id]?.full_name || null,
        avatar_url: roleProfiles[r.user_id]?.avatar_url || null,
      }));
    });

    let webResults: any[] = [];
    try {
      const webResponse = await fetch(`${supabaseUrl}/functions/v1/search-credits-web`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      if (webResponse.ok) {
        const webData = await webResponse.json();
        webResults = Array.isArray(webData?.results) ? webData.results : [];
      } else {
        console.warn('search-credits-web failed:', webResponse.status, await webResponse.text());
      }
    } catch (webErr) {
      console.error('search-credits-web invocation error:', webErr);
    }

    const existingProjectNames = new Set(platformCredits.map((credit) => normalizeText(credit.project_name)));
    const visualResults = webResults
      .filter((result) => result?.title)
      .filter((result) => !existingProjectNames.has(normalizeText(result.title)))
      .slice(0, 10)
      .map((result) => ({
        title: result.title,
        subtitle: result.role_suggestion || undefined,
        type: result.type || 'work',
        year: result.year || undefined,
        platform: result.platform || undefined,
        description: result.description || undefined,
        image_url: result.image_url || undefined,
        url: result.url || undefined,
      }));

    let externalResults: any = {
      knowledge_card: null,
      alternative_matches: [],
      visual_results: visualResults,
      related_searches: buildRelatedSearches(trimmedQuery),
    };

    if (lovableApiKey && webResults.length > 0) {
      try {
        const platformContext = [
          ...platformProfiles.map((profile) => `Platform profile: ${profile.full_name} (${profile.role || 'creator'})`),
          ...platformCredits.map((credit) => `Platform credit: ${credit.project_name}`),
        ].slice(0, 12).join('\n');

        const groundedWebContext = webResults.slice(0, 10).map((result, index) => [
          `Result ${index + 1}:`,
          `Title: ${result.title || ''}`,
          `Type: ${result.type || ''}`,
          `Platform: ${result.platform || ''}`,
          `Description: ${result.description || ''}`,
          `URL: ${result.url || ''}`,
          `Image URL: ${result.image_url || ''}`,
          `Year: ${result.year || ''}`,
          `Location: ${result.location || ''}`,
          `Brand: ${result.client_brand || ''}`,
        ].filter(Boolean).join('\n')).join('\n---\n');

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GEMINI_FLASH,
            messages: [
              {
                role: 'system',
                content: `You are structuring search results for a creative industry search engine. You MUST ONLY use the grounded web results provided. Never invent facts, followers, collaborations, counts, credits, or biographies.

Rules:
1. If the results clearly point to ONE specific person/project, build a knowledge_card for the MOST prominent match AND still populate alternative_matches with any other distinct identities found.
2. If the query is ambiguous or points to multiple identities, set knowledge_card to the most prominent one and put ALL OTHER distinct identities in alternative_matches.
3. CRITICAL: alternative_matches should contain EVERY distinct person/entity found in the results that is NOT the knowledge_card subject. Even if there's only one main match, look for other people with similar names or handles. Always try to find at least 1-2 alternatives.
4. Keep related_searches short and practical. Include name variations to help users find the right person.
5. Do not output visual_results; those are handled separately.
6. CRITICAL: Always include image_url fields when an Image URL is available in the web results. This is essential for visual identification.

Return JSON only in this shape:
{
  "knowledge_card": {
    "type": "person" | "production" | "brand" | "event" | "podcast" | "channel" | "concept",
    "name": "Official name",
    "description": "1-2 sentence grounded summary",
    "image_url": "Profile/avatar image URL from the results or null",
    "known_for": ["Work 1", "Work 2"],
    "industry": "Music | Film | Content Creation | Fashion | Mixed | etc",
    "key_credits": [
      {"project": "Project Name", "role": "Role", "year": 2024, "platform": "Spotify", "image_suggestion": "Short grounded visual hint"}
    ],
    "collaborators": ["Name 1"],
    "fun_fact": "Optional grounded detail",
    "claim_prompt": "Short claim prompt",
    "platforms": ["Spotify", "YouTube"],
    "social_links": {"instagram": "url or handle"}
  },
  "alternative_matches": [
    {
      "name": "Full Name or identity label",
      "description": "One-line grounded summary",
      "image_url": "Profile/avatar image URL from the results or null",
      "industry": "Industry",
      "location": "Location if stated",
      "known_for": ["Known item 1", "Known item 2"]
    }
  ],
  "related_searches": ["search 1", "search 2", "search 3", "search 4", "search 5"]
}`,
              },
              {
                role: 'user',
                content: `Search query: "${trimmedQuery}"

Existing platform results:
${platformContext || 'None'}

Grounded web results:
${groundedWebContext}`,
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const finishReason = aiData.choices?.[0]?.finish_reason || aiData.stop_reason;
          if (finishReason !== 'length' && finishReason !== 'max_tokens') {
            const content = aiData.choices?.[0]?.message?.content;
            if (content) {
              const grounded = extractJsonObject(content);
              externalResults = {
                knowledge_card: grounded?.knowledge_card || null,
                alternative_matches: Array.isArray(grounded?.alternative_matches) ? grounded.alternative_matches : [],
                visual_results: visualResults,
                related_searches: Array.isArray(grounded?.related_searches) && grounded.related_searches.length > 0
                  ? grounded.related_searches
                  : buildRelatedSearches(trimmedQuery),
              };
            }
          }
        }
      } catch (aiErr) {
        console.error('Grounded search synthesis error:', aiErr);
      }
    }

    return new Response(JSON.stringify({
      platform: {
        profiles: platformProfiles,
        credits: platformCredits,
        opportunities: platformOpps,
      },
      external: externalResults,
      query: trimmedQuery,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Universal search error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});