import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { RateLimiter } from "../_shared/rate-limiter.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validation schema
const ApplicationSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(100).trim(),
  role: z.string().min(2).max(50).trim(),
  bio: z.string().max(500).trim(),
  whyJoin: z.string().max(500).trim(),
  socialLinks: z.object({
    instagram: z.string().url().max(500).nullable().optional(),
    twitter: z.string().url().max(500).nullable().optional(),
    linkedin: z.string().url().max(500).nullable().optional(),
    spotify: z.string().url().max(500).nullable().optional(),
    website: z.string().url().max(500).nullable().optional(),
  }).optional(),
});

// Rate limiter: 3 submissions per IP per hour
const rateLimiter = new RateLimiter({ points: 3, duration: 3600 });

// Sanitize to prevent prompt injection
const sanitize = (input: string): string => {
  return input.replace(/[<>"'`{}[\]]/g, '').slice(0, 500);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 'unknown';
    
    try {
      await rateLimiter.consume(ip);
    } catch (error) {
      const retryAfter = rateLimiter.getRemainingTime(ip);
      return new Response(
        JSON.stringify({ 
          error: 'Too many submissions. Please try again later.',
          retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString()
          } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate input
    const rawData = await req.json();
    let applicationData;
    
    try {
      applicationData = ApplicationSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid application data', 
            details: validationError.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }
    const { email, fullName, role, bio, whyJoin, socialLinks } = applicationData;

    // Build AI validation prompt with sanitized inputs
    const prompt = `Evaluate this creator application for Kretopia, a creative networking platform. Score 0-100.

APPLICANT INFO:
Name: ${sanitize(fullName)}
Role: ${sanitize(role)}
Bio: ${sanitize(bio || "Not provided")}
Why Join: ${sanitize(whyJoin || "Not provided")}

SOCIAL PROOF:
Instagram: ${socialLinks?.instagram || "None"}
Twitter: ${socialLinks?.twitter || "None"}
LinkedIn: ${socialLinks?.linkedin || "None"}
Spotify: ${socialLinks?.spotify || "None"}
Website: ${socialLinks?.website || "None"}

SCORING CRITERIA:
- Professional Profile (25pts): Clear role, quality bio, professional presence
- Social Verification (25pts): Active social media, real following indicators, verifiable links
- Platform Fit (25pts): Aligns with creator economy (artists, musicians, designers, filmmakers, content creators)
- Completeness (25pts): Filled required fields, provides context about goals

DECISION RULES:
- AUTO-APPROVE if 70+ (high-quality creator profile, clear professional presence)
- FLAG FOR REVIEW if 50-69 (potential but needs human verification)
- AUTO-REJECT if below 50 (incomplete, spam-like, or not creator-focused)

Return JSON only (no markdown):
{
  "score": 85,
  "decision": "approve",
  "reasoning": "Brief explanation of score",
  "suggested_message": "Personalized welcome or feedback message"
}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { 
            role: "system", 
            content: "You are a quality control AI for a creator platform. Be generous with legitimate creators but filter out spam. Return only valid JSON." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI validation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || "";
    
    // Parse AI response (handle markdown code blocks)
    let evaluation;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      evaluation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("AI response parsing failed:", content);
      // Default to manual review if parsing fails
      evaluation = {
        score: 60,
        decision: "review",
        reasoning: "AI response parsing failed - needs manual review",
        suggested_message: "Thank you for applying. We're reviewing your application and will get back to you soon!"
      };
    }

    // Determine status based on decision
    let status = "pending";
    let inviteCode: string | null = null;
    
    if (evaluation.decision === "approve") {
      status = "auto_approved";
      
      // Generate invite code for auto-approved user
      const inviteCodeStr = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: inviteData, error: inviteError } = await supabase
        .from("invites")
        .insert({
          inviter_id: "00000000-0000-0000-0000-000000000000", // System placeholder
          invitee_email: email,
          invite_code: inviteCodeStr,
          max_uses: 1,
          current_uses: 0,
        })
        .select()
        .single();

      if (inviteError) {
        console.error("Failed to create invite:", inviteError);
      } else {
        inviteCode = inviteData.invite_code;
        
        // Send invite email
        try {
          await supabase.functions.invoke('send-waitlist-invite', {
            body: {
              to: email,
              fullName: fullName,
              inviteCode: inviteCode
            }
          });
          console.log(`Sent invite email to ${email} with code ${inviteCode}`);
        } catch (emailError) {
          console.error("Failed to send invite email:", emailError);
          // Don't fail the whole process if email fails
        }
      }
    } else if (evaluation.decision === "review") {
      status = "review";
    } else {
      status = "rejected";
    }

    // Insert into waitlist table
    const { data: waitlistEntry, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        email: email,
        full_name: fullName,
        role: role,
        bio: bio || null,
        why_join: whyJoin || null,
        instagram_url: socialLinks?.instagram ?? null,
        twitter_url: socialLinks?.twitter ?? null,
        linkedin_url: socialLinks?.linkedin ?? null,
        spotify_url: socialLinks?.spotify ?? null,
        website: socialLinks?.website ?? null,
        status: status,
        ai_score: evaluation.score,
        ai_decision: evaluation.decision,
        ai_reasoning: evaluation.reasoning,
        invite_code: inviteCode,
        invite_sent_at: inviteCode ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert waitlist entry:", insertError);
      throw insertError;
    }

    console.log(`Waitlist application processed: ${email}, Decision: ${evaluation.decision}, Score: ${evaluation.score}`);

    return new Response(
      JSON.stringify({
        success: true,
        decision: evaluation.decision,
        score: evaluation.score,
        reasoning: evaluation.reasoning,
        inviteCode: inviteCode,
        message: evaluation.suggested_message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
