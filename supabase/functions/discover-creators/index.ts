import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Same gap the plain-filter grid search had until this pass: with no
    // caller identity, this had no way to exclude "yourself" from your own
    // search results. Best-effort -- an anonymous/expired token just means
    // no self-exclusion, not a failed request.
    let callerUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      callerUserId = data.user?.id ?? null;
    }

    // Only gate signed-in callers -- this endpoint intentionally still
    // serves anonymous/expired-token requests (see comment above), so an
    // unauthenticated caller has no per-user identity to key a limit on.
    if (callerUserId) {
      const rateLimit = await checkAiFeatureRateLimit(supabase, callerUserId, "discover-creators");
      if (!rateLimit.allowed) return rateLimit.response;
    }

    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.length < 3) {
      return new Response(JSON.stringify({ error: 'Query must be at least 3 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Fetch all credits with profile data (batched)
    const { data: credits } = await supabase
      .from('credits')
      .select('user_id, project_name, role, year, verification_status, platform, client_brand, endorsement_count, ai_confidence')
      .limit(500);

    // Aggregate credits per user
    const userMap = new Map<string, {
      credit_count: number;
      verified_count: number;
      projects: string[];
      roles: string[];
      summary: string;
    }>();

    (credits || []).forEach(c => {
      const entry = userMap.get(c.user_id) || { credit_count: 0, verified_count: 0, projects: [], roles: [], summary: '' };
      entry.credit_count++;
      if (c.verification_status === 'verified' || (c.ai_confidence && c.ai_confidence >= 0.7)) {
        entry.verified_count++;
      }
      if (c.project_name && !entry.projects.includes(c.project_name)) entry.projects.push(c.project_name);
      if (c.role && !entry.roles.includes(c.role)) entry.roles.push(c.role);
      entry.summary += `${c.project_name} (${c.role}, ${c.year || 'N/A'}), `;
      userMap.set(c.user_id, entry);
    });

    if (userMap.size === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch profiles for these users (excluding the caller themselves)
    interface ProfileRow {
      user_id: string;
      full_name: string | null;
      avatar_url: string | null;
      role: string | null;
      location: string | null;
      verification_tier: string | null;
      average_rating: number | null;
      bio: string | null;
    }
    const userIds = Array.from(userMap.keys()).filter(id => id !== callerUserId);
    const { data: profiles }: { data: ProfileRow[] | null } = userIds.length > 0
      ? await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, role, location, verification_tier, average_rating, bio')
          .in('user_id', userIds)
      : { data: [] };

    // Step 3: Use AI to rank and match
    let results: any[] = [];

    if (lovableApiKey && profiles && profiles.length > 0) {
      const creatorsContext = profiles.slice(0, 50).map(p => {
        const creds = userMap.get(p.user_id);
        return {
          id: p.user_id,
          name: p.full_name,
          role: p.role,
          location: p.location,
          verified_credits: creds?.verified_count || 0,
          total_credits: creds?.credit_count || 0,
          top_projects: creds?.projects.slice(0, 5) || [],
          top_roles: creds?.roles.slice(0, 5) || [],
          rating: p.average_rating,
          tier: p.verification_tier,
        };
      });

      try {
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
                content: `You are a creative talent matching engine. Given a search query and a list of creators with their verified credits, rank and score the most relevant matches. Return JSON array of matches:
[{ "id": "user_id", "score": 0-100, "reason": "brief explanation of why they match" }]
Prioritize: 1) Verified credit relevance 2) Role match 3) Industry experience 4) Rating. Return max 15 results, minimum score 20.`
              },
              {
                role: 'user',
                content: `Search: "${query}"\n\nCreators:\n${JSON.stringify(creatorsContext)}`
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const matches = Array.isArray(parsed) ? parsed : parsed.matches || parsed.results || [];
            
            results = matches
              .filter((m: any) => m.id && m.score >= 20)
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 15)
              .map((m: any) => {
                const profile = profiles.find(p => p.user_id === m.id);
                const creds = userMap.get(m.id);
                return {
                  user_id: m.id,
                  full_name: profile?.full_name || 'Unknown',
                  avatar_url: profile?.avatar_url,
                  role: profile?.role,
                  location: profile?.location,
                  verification_tier: profile?.verification_tier,
                  average_rating: profile?.average_rating,
                  verified_credit_count: creds?.verified_count || 0,
                  total_credit_count: creds?.credit_count || 0,
                  top_roles: creds?.roles.slice(0, 5) || [],
                  top_projects: creds?.projects.slice(0, 5) || [],
                  match_score: Math.min(100, Math.max(0, m.score)),
                  match_reason: m.reason || 'Matched based on verified credits',
                };
              });
          }
        }
      } catch (aiErr) {
        console.error('AI matching error:', aiErr);
      }
    }

    // Fallback: text-based matching if AI fails
    if (results.length === 0 && profiles) {
      const q = query.toLowerCase();
      results = profiles
        .filter(p => {
          const creds = userMap.get(p.user_id);
          const searchStr = [p.full_name, p.role, p.location, ...(creds?.projects || []), ...(creds?.roles || [])].join(' ').toLowerCase();
          return searchStr.includes(q);
        })
        .slice(0, 15)
        .map(p => {
          const creds = userMap.get(p.user_id);
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            role: p.role,
            location: p.location,
            verification_tier: p.verification_tier,
            average_rating: p.average_rating,
            verified_credit_count: creds?.verified_count || 0,
            total_credit_count: creds?.credit_count || 0,
            top_roles: creds?.roles.slice(0, 5) || [],
            top_projects: creds?.projects.slice(0, 5) || [],
            match_score: 60,
            match_reason: 'Matched by keyword relevance',
          };
        });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Discovery error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
