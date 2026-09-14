import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { GEMINI_FLASH, GEMINI_FLASH_IMAGE_PREVIEW } from "../_shared/aiModels.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Was previously fully unauthenticated (no config.toml entry, so the
    // platform default verify_jwt=true was trivially satisfied by the
    // public anon key, and no in-body check ran either) -- an open relay
    // to a paid LLM gateway for both text and image generation. All 16
    // frontend callers already run behind an authenticated app surface and
    // already send the user's real session JWT via supabase.functions.invoke,
    // so requiring and validating it here changes nothing for them.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authedClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const rateLimit = await checkAiFeatureRateLimit(admin, userId, "generate-content");
    if (!rateLimit.allowed) return rateLimit.response;

    const body = await req.json();
    const { type, messages: rawMessages, prompt } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log('Generating content for type:', type);

    // Normalize messages: support both { messages } and { prompt }
    let messages = rawMessages as any[] | undefined;
    if ((!messages || !Array.isArray(messages)) && typeof prompt === 'string' && prompt.trim().length > 0) {
      messages = [{ role: 'user', content: prompt }];
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.warn('[generate-content] No valid messages or prompt provided, returning fallback content');
      return new Response(
        JSON.stringify({ content: 'No AI content generated because no prompt was provided.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use different models based on content type
    const isImageGeneration = type === 'image';
    const model = isImageGeneration ? GEMINI_FLASH_IMAGE_PREVIEW : GEMINI_FLASH;
    
    const requestBody: any = {
      model: model,
      messages: messages,
    };

    // Add modalities for image generation
    if (isImageGeneration) {
      requestBody.modalities = ["image", "text"];
    }

    // Add tool calling for task suggestions
    if (type === "suggest") {
      requestBody.tools = [
        {
          type: "function",
          function: {
            name: "suggest_tasks",
            description: "Return 3-5 actionable task suggestions.",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      category: { type: "string" }
                    },
                    required: ["title", "priority", "category"],
                    additionalProperties: false
                  }
                }
              },
              required: ["suggestions"],
              additionalProperties: false
            }
          }
        }
      ];
      requestBody.tool_choice = { type: "function", function: { name: "suggest_tasks" } };
    }

    // Use Lovable AI for content generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('AI generation failed:', response.status);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your workspace." }),
          { 
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const images = data.choices[0].message.images;

    console.log('Content generated successfully');

    return new Response(
      JSON.stringify({ 
        content,
        images: images || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-content function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
