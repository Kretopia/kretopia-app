import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { partnerSubmissionSchema, validateInput } from '../_shared/validation.ts';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Authorization: submissions require an authenticated user ---
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: authData } = jwt
      ? await supabase.auth.getUser(jwt)
      : { data: { user: null } as any };
    const user = authData?.user;
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const rawBody = await req.json();
    const validation = validateInput(partnerSubmissionSchema, {
      company_name: rawBody.company_name,
      contact_name: rawBody.contact_name,
      contact_email: rawBody.contact_email,
      contact_phone: rawBody.contact_phone,
      website_url: rawBody.website_url,
      description: rawBody.description,
      category: rawBody.category,
      discount_type: rawBody.discount_type,
      discount_value: rawBody.discount_value,
      terms: rawBody.terms,
      tier_required: rawBody.tier_required ?? 'free',
    });
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    const submissionData: any = {
      ...validation.data,
      logo_url: typeof rawBody.logo_url === 'string' ? rawBody.logo_url.slice(0, 2048) : null,
      redemption_url: typeof rawBody.redemption_url === 'string' ? rawBody.redemption_url.slice(0, 2048) : null,
      redemption_code: typeof rawBody.redemption_code === 'string' ? rawBody.redemption_code.slice(0, 200) : null,
    };

    console.log('Processing partner submission:', submissionData.company_name);

    // Use AI to categorize the company
    const aiPrompt = `Analyze this company and categorize it into ONE of these categories: coworking, software, equipment, services, wellness, education, cafe, other.

Company Name: ${submissionData.company_name}
Description: ${submissionData.description}
Website: ${submissionData.website_url || 'Not provided'}

Return ONLY the category name (lowercase, one word). Examples: "cafe", "coworking", "software", "services"`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: 'user', content: aiPrompt }],
      }),
    });

    let aiCategory = submissionData.category; // fallback to user-selected

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const suggestedCategory = aiData.choices[0]?.message?.content?.trim().toLowerCase();
      const validCategories = ['coworking', 'software', 'equipment', 'services', 'wellness', 'education', 'cafe', 'other'];
      if (validCategories.includes(suggestedCategory)) {
        aiCategory = suggestedCategory;
        console.log('AI categorized as:', aiCategory);
      }
    }

    // Record submission as PENDING — publishing happens only via the admin review flow.
    const { data: submission, error: submissionError } = await supabase
      .from('partner_submissions')
      .insert({
        ...submissionData,
        category: aiCategory,
        status: 'pending',
      })
      .select('id')
      .single();

    if (submissionError) {
      console.error('Error recording submission:', submissionError);
      throw submissionError;
    }

    console.log('Partner submission received for review:', submissionData.company_name);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'pending',
        category: aiCategory,
        submission_id: submission.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-partner-submission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process submission';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});