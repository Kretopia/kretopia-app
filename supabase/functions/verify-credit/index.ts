import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rateLimit = await checkAiFeatureRateLimit(supabase, user.id, "verify-credit");
    if (!rateLimit.allowed) return rateLimit.response;

    const { credit_id } = await req.json();
    if (!credit_id) {
      return new Response(JSON.stringify({ error: 'credit_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Previously trusted client-supplied project_name/role/year/platform with
    // no check that credit_id even belonged to the caller -- any logged-in
    // user could plant a fabricated AI verification against any other
    // user's credit. Re-derive everything from the credit's own DB row.
    const { data: credit, error: creditError } = await supabase
      .from('credits')
      .select('user_id, project_name, role, year, platform')
      .eq('id', credit_id)
      .single();

    if (creditError || !credit) {
      return new Response(JSON.stringify({ error: 'Credit not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (credit.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { project_name, role, year, platform } = credit;
    const searchQuery = [project_name, role, platform, year].filter(Boolean).join(' ');
    let confidenceScore = 0;
    let evidenceLinks: any[] = [];
    let aiSummary = 'Unable to verify — no AI service available';
    let status = 'pending';

    // Use Lovable AI to assess the credit
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are a credit verification assistant for a creative industry platform. Your job is to assess the plausibility of professional credits claimed by creatives. Respond in JSON format with:
- confidence: a number from 0 to 1 (0 = likely fake, 0.5 = uncertain, 1 = very plausible)
- reasoning: a brief explanation
- suggestions: array of search terms someone could use to verify this
- status: "verified" if confidence >= 0.7, "unverifiable" if confidence < 0.3, otherwise "pending"

Consider: Is this a real project/event that existed? Is the role plausible? Does the year make sense?`
              },
              {
                role: 'user',
                content: `Assess this credit:\n- Project: ${project_name}\n- Role: ${role}\n- Year: ${year || 'not specified'}\n- Platform/Venue: ${platform || 'not specified'}`
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
            confidenceScore = Math.min(1, Math.max(0, parsed.confidence || 0));
            aiSummary = parsed.reasoning || 'Assessment complete';
            status = parsed.status || (confidenceScore >= 0.7 ? 'verified' : confidenceScore < 0.3 ? 'unverifiable' : 'pending');
            evidenceLinks = (parsed.suggestions || []).map((s: string) => ({ type: 'search_suggestion', query: s }));
          }
        }
      } catch (aiError) {
        console.error('AI verification error:', aiError);
        aiSummary = 'AI verification temporarily unavailable';
      }
    }

    // Store results
    const { data, error } = await supabase
      .from('credit_ai_verifications')
      .upsert({
        credit_id,
        search_query: searchQuery,
        status,
        confidence_score: confidenceScore,
        evidence_links: evidenceLinks,
        ai_summary: aiSummary,
        last_checked_at: new Date().toISOString(),
      }, { onConflict: 'credit_id' })
      .select()
      .single();

    if (error) throw error;

    // Update credit's ai_confidence
    await supabase
      .from('credits')
      .update({ ai_confidence: confidenceScore })
      .eq('id', credit_id);

    return new Response(JSON.stringify({ 
      success: true, 
      verification: data,
      confidence: confidenceScore,
      summary: aiSummary,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in verify-credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
