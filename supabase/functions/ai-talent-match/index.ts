import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Verify user
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const rateLimit = await checkAiFeatureRateLimit(supabase, user.id, "ai-talent-match");
    if (!rateLimit.allowed) return rateLimit.response;

    const { opportunity_id, role_filter, skills_filter, brief_text, limit = 10 } = await req.json();

    // Build context from opportunity or freeform brief
    let opportunityContext = '';
    
    if (brief_text && typeof brief_text === 'string' && brief_text.trim().length > 0) {
      opportunityContext = `Hiring Brief:\n${brief_text.trim()}`;
    }
    
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunity_id)
        .single();

      if (opp) {
        opportunityContext = `
Job Title: ${opp.title}
Description: ${opp.description || 'N/A'}
Type: ${opp.type || 'N/A'}
Skills Required: ${Array.isArray(opp.required_skills) ? opp.required_skills.join(', ') : 'N/A'}
Budget: ${opp.budget_min ? `$${opp.budget_min}-$${opp.budget_max}` : 'N/A'}
Location: ${opp.location || 'Remote'}`;
      }
    }

    // Fetch candidate profiles (exclude company accounts, get onboarded users)
    let query = supabase
      .from('profiles')
      .select('user_id, full_name, role, bio, avatar_url, location, level, xp, professional_skills, account_type')
      .eq('onboarding_completed', true)
      .neq('user_id', user.id)
      .not('avatar_url', 'is', null)
      .limit(50);

    // Filter by role if specified
    if (role_filter) {
      query = query.ilike('role', `%${role_filter}%`);
    }

    const { data: candidates } = await query;

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: 'No candidates found yet. Suggestions will appear as more creators join.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing shortlists to exclude
    const { data: existingShortlist } = await supabase
      .from('talent_shortlist')
      .select('talent_user_id')
      .eq('company_user_id', user.id)
      .eq('status', 'suggested');

    const shortlistedIds = new Set((existingShortlist || []).map(s => s.talent_user_id));

    // Filter out already shortlisted and company accounts
    const eligibleCandidates = candidates.filter(
      c => !shortlistedIds.has(c.user_id) && c.account_type !== 'company'
    );

    if (eligibleCandidates.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: 'All available creators have been reviewed.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build candidate summaries for AI
    const candidateSummaries = eligibleCandidates.slice(0, 30).map((c, i) => {
      const skills = Array.isArray(c.professional_skills)
        ? c.professional_skills.map((s: any) => typeof s === 'string' ? s : s?.skill || '').filter(Boolean).join(', ')
        : 'N/A';
      return `[${i}] ${c.full_name} | Role: ${c.role || 'Creator'} | Skills: ${skills} | Location: ${c.location || 'N/A'} | Level: ${c.level || 1} | XP: ${c.xp || 0}`;
    }).join('\n');

    // AI scoring via tool calling
    const aiPrompt = opportunityContext
      ? `You are a talent matching AI for a creative industry platform. A company is hiring for this role:\n\n${opportunityContext}\n\nRank the top ${limit} best-fit candidates from this pool and explain why each is a good match:\n\n${candidateSummaries}`
      : `You are a talent matching AI for a creative industry platform. ${role_filter ? `The company is looking for: ${role_filter}` : 'Suggest the strongest creative talent'}${skills_filter ? `. Required skills: ${skills_filter}` : ''}.\n\nRank the top ${limit} best candidates from this pool:\n\n${candidateSummaries}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an expert creative talent recruiter. Analyze candidate profiles and return structured rankings. Be specific about WHY each candidate is a good fit based on skills, experience level, and role alignment."
          },
          { role: "user", content: aiPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "rank_candidates",
            description: "Return ranked list of best-fit candidates with scores and reasons",
            parameters: {
              type: "object",
              properties: {
                rankings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number", description: "Candidate index from the list" },
                      score: { type: "number", description: "Match score 0-100" },
                      reasons: { type: "array", items: { type: "string" }, description: "2-3 specific reasons this candidate is a good fit" },
                      headline: { type: "string", description: "One-line summary of why to hire this person" }
                    },
                    required: ["index", "score", "reasons", "headline"],
                    additionalProperties: false
                  }
                }
              },
              required: ["rankings"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "rank_candidates" } }
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required." }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      throw new Error(`AI failed: ${status}`);
    }

    const aiData = await aiResponse.json();
    let rankings: any[] = [];

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        rankings = parsed.rankings || [];
      } catch { /* fallback below */ }
    }

    // Build response with full profile data
    const suggestions = rankings
      .filter(r => r.index >= 0 && r.index < eligibleCandidates.length)
      .slice(0, limit)
      .map(r => {
        const candidate = eligibleCandidates[r.index];
        return {
          user_id: candidate.user_id,
          full_name: candidate.full_name,
          role: candidate.role,
          avatar_url: candidate.avatar_url,
          location: candidate.location,
          level: candidate.level,
          xp: candidate.xp,
          professional_skills: candidate.professional_skills,
          match_score: Math.min(r.score, 99),
          match_reasons: r.reasons,
          headline: r.headline,
        };
      });

    // Auto-save suggestions to shortlist
    if (suggestions.length > 0) {
      const shortlistInserts = suggestions.map(s => ({
        company_user_id: user.id,
        talent_user_id: s.user_id,
        opportunity_id: opportunity_id || null,
        match_score: s.match_score,
        match_reasons: s.match_reasons,
        status: 'suggested',
      }));

      await supabase.from('talent_shortlist').upsert(shortlistInserts, {
        onConflict: 'company_user_id,talent_user_id,opportunity_id'
      });
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ai-talent-match error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
