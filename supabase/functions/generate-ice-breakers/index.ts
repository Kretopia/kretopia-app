import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { recipientId, recipientName, recipientRole, currentUserRole } = await req.json();

    // Get auth header to fetch user info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Fetch recipient's profile for more context
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('bio, professional_skills, collab_intent, location')
      .eq('user_id', recipientId)
      .single();

    // Fetch some portfolio items for context
    const { data: portfolioItems } = await supabase
      .from('portfolio_items')
      .select('title, description, media_type')
      .eq('user_id', recipientId)
      .limit(3);

    const portfolioContext = portfolioItems?.length 
      ? `They have portfolio pieces: ${portfolioItems.map(p => p.title).join(', ')}.`
      : '';

    const skillsContext = recipientProfile?.professional_skills?.length
      ? `Their skills include: ${recipientProfile.professional_skills.slice(0, 5).map((s: any) => typeof s === 'string' ? s : s.skill).join(', ')}.`
      : '';

    const intentContext = recipientProfile?.collab_intent
      ? `They're looking to: ${recipientProfile.collab_intent}.`
      : '';

    const prompt = `Generate 4 unique, friendly conversation starters for a creator collaboration platform. 
The sender is a ${currentUserRole} reaching out to ${recipientName}, a ${recipientRole}.
${skillsContext}
${portfolioContext}
${intentContext}

Rules:
- Keep each message under 100 characters
- Make them specific and personalized when possible
- Be warm and professional
- Focus on collaboration potential
- No generic "Hi, how are you?" messages

Return ONLY a JSON array of 4 strings, no other text. Example: ["message1", "message2", "message3", "message4"]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: 'system', content: 'You generate personalized conversation starters for a creator collaboration platform. Always respond with valid JSON arrays only.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON response
    let iceBreakers: string[];
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      iceBreakers = JSON.parse(cleanedContent);
    } catch {
      console.error('Failed to parse AI response:', content);
      // Fallback ice breakers
      iceBreakers = [
        `Hey ${recipientName}! I'd love to collaborate on something creative together.`,
        `Hi! Your work caught my eye. What projects are you working on?`,
        `Hey there! I think our skills could complement each other well.`,
        `Hi ${recipientName}! Would love to chat about a potential collab.`,
      ];
    }

    return new Response(JSON.stringify({ iceBreakers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating ice breakers:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      iceBreakers: [
        "Hey! I noticed we matched - what kind of projects are you working on?",
        "Love your portfolio! Would be great to chat about a collaboration.",
        "Hi! What type of creative work are you most passionate about?",
        "Hey there! I'm looking for talented creators to work with.",
      ]
    }), {
      status: 200, // Return 200 with fallback ice breakers
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
