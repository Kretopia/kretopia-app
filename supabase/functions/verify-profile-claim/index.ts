import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Records the real, server-computed result under service_role and returns
// an opaque single-use token. claim-and-create-profile consumes that token
// to decide identity_face_verified — it never trusts a client-supplied
// confidence number again (that was spoofable: nothing bound the claim
// step's face_match_score to this function having actually run). See
// docs/SECURITY_RELEASE_GATE.md C11.
async function recordAttempt(verified: boolean, confidence: number | null): Promise<string | null> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return null;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin
      .from("face_verification_attempts")
      .insert({ verified, confidence })
      .select("token")
      .single();
    if (error) {
      console.error("[verify-profile-claim] failed to record attempt:", error);
      return null;
    }
    return data.token as string;
  } catch (e) {
    console.error("[verify-profile-claim] recordAttempt error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId, profileImageUrl, selfieImage, profileName } = await req.json();

    if (!profileImageUrl || !selfieImage) {
      return new Response(
        JSON.stringify({ 
          verified: false, 
          reason: 'Missing required images for verification' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Starting face verification for profile:', profileId);
    console.log('Profile name:', profileName);
    console.log('Profile image URL:', profileImageUrl);

    // Use Lovable AI with vision capabilities to compare faces
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a face verification AI assistant. Your task is to compare two face images and determine if they show the same person.

Analyze the facial features carefully:
- Face shape and structure
- Eye shape, size, and spacing
- Nose shape and size
- Mouth and lip shape
- Jawline and chin structure
- Overall facial proportions

Consider that:
- Lighting conditions may differ
- Angles may be slightly different
- One image may be a professional photo while the other is a selfie
- The person may have minor appearance changes (hairstyle, facial hair, makeup)

You must respond with a JSON object:
{
  "verified": boolean (true if same person, false otherwise),
  "confidence": number (0.0 to 1.0, your confidence level),
  "reason": string (brief explanation of your decision)
}

Be conservative but fair. Only verify if you're reasonably confident (>70%) that it's the same person.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please compare these two images to verify if they show the same person. The first image is the profile photo of "${profileName}" and the second is a selfie taken for verification.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: profileImageUrl
                }
              },
              {
                type: 'image_url',
                image_url: {
                  url: selfieImage
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ verified: false, reason: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ verified: false, reason: 'AI service unavailable. Please try again later.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log('AI response:', content);

    // Parse the JSON response from AI
    let result;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Default to not verified if we can't parse
      result = {
        verified: false,
        confidence: 0,
        reason: 'Unable to analyze images. Please try again with clearer photos.'
      };
    }

    console.log('Verification result:', result);

    const finalVerified = result.verified === true && result.confidence >= 0.7;
    const token = await recordAttempt(finalVerified, result.confidence ?? null);

    return new Response(
      JSON.stringify({
        verified: finalVerified,
        confidence: result.confidence,
        reason: result.reason,
        token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Verification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Verification service error. Please try again.';
    return new Response(
      JSON.stringify({ 
        verified: false, 
        reason: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});