import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { title, description, compensation } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Combine content for moderation
    const content = `Title: ${title}\nDescription: ${description}\nCompensation: ${compensation || 'Not specified'}`;

    console.log('Moderating content:', content);

    // Use Lovable AI for content moderation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: "You are a content moderation system. Analyze job/opportunity posts for spam, illegal content, scams, adult content, violence, hate speech, or anything inappropriate. Respond with JSON only: {\"flagged\": boolean, \"reason\": string or null}. If content is safe, set flagged to false."
          },
          {
            role: "user",
            content: content
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('AI moderation failed:', response.status);
      // Fail open - if AI is down, allow the post
      return new Response(
        JSON.stringify({ flagged: false, reason: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('AI moderation response:', aiResponse);

    // Parse AI response
    let moderationResult;
    try {
      moderationResult = JSON.parse(aiResponse);
    } catch {
      // If parsing fails, try to extract from text
      const flagged = aiResponse.toLowerCase().includes('"flagged": true');
      moderationResult = { flagged, reason: flagged ? "Content flagged by AI" : null };
    }

    return new Response(
      JSON.stringify(moderationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in moderate-opportunity function:', error);
    // Fail open - if there's an error, allow the post
    return new Response(
      JSON.stringify({ flagged: false, reason: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
