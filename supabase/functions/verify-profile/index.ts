import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validation schema for profile data
const ProfileDataSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  role: z.string().min(2).max(50).trim(),
  bio: z.string().max(1000).trim(),
  location: z.string().max(200).optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  portfolioItems: z.number().int().min(0).optional(),
  portfolioCount: z.number().int().min(0).default(0),
  creditsCount: z.number().int().min(0).default(0),
  awardsCount: z.number().int().min(0).default(0),
  pressCount: z.number().int().min(0).default(0),
  socialVerified: z.boolean().optional(),
  socialLinks: z.object({
    instagram: z.string().url().max(500).optional().or(z.literal('')),
    twitter: z.string().url().max(500).optional().or(z.literal('')),
    linkedin: z.string().url().max(500).optional().or(z.literal('')),
    spotify: z.string().url().max(500).optional().or(z.literal('')),
    behance: z.string().url().max(500).optional().or(z.literal('')),
    imdb: z.string().url().max(500).optional().or(z.literal('')),
  }).optional(),
  accountType: z.enum(["individual", "company"]),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Validate input
    const rawData = await req.json();
    let profileData;
    
    try {
      profileData = ProfileDataSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ error: "Invalid profile data", details: validationError.errors }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      throw validationError;
    }
    const { 
      fullName, role, bio, website, socialLinks, 
      portfolioItems, accountType,
      portfolioCount = 0,
      creditsCount = 0,
      awardsCount = 0,
      pressCount = 0,
      socialVerified = false
    } = profileData;

    // Build AI verification prompt
    const prompt = `You are a profile verification AI for Kretopia, an exclusive creative and content creator platform. Evaluate this profile for authenticity, industry fit, and quality standards.

PROFILE DATA:
Name: ${fullName}
Account Type: ${accountType === "company" ? "Business/Brand" : "Individual Creator"}
Role: ${role}
Bio: ${bio || "Not provided"}
Website: ${website || "None"}
Portfolio Items: ${portfolioItems || 0}

SOCIAL LINKS:
${Object.entries(socialLinks || {}).map(([platform, url]) => `${platform}: ${url || "None"}`).join("\n")}

VERIFICATION CRITERIA - WEIGHTED POINT SYSTEM:

1. PORTFOLIO (40 points max) - PRIMARY DRIVER:
   - 2-3 items: 15 points (minimum viable)
   - 4-6 items: 28 points (solid body of work)
   - 7-10 items: 35 points (experienced creator)
   - 10+ items: 40 points (extensive portfolio)
   
2. CREDITS (25 points max) - PROFESSIONAL BOOST:
   - 3 points per credit, caps at 25 points
   - Shows real professional work and collaborations
   
3. SOCIAL PROOF (20 points max):
   - 1 platform: 8 points
   - 2-3 platforms: 15 points
   - 4+ platforms: 20 points
   - Bonus: Add 5 points if any platform shows verification/significant following
   
4. AWARDS (10 points max) - PRESTIGE BONUS:
   - 1 award: 7 points
   - 2+ awards: 10 points
   - Not required, but significantly boosts credibility
   
5. PRESS (5 points max) - CREDIBILITY BOOST:
   - 5 points for any press features (caps at 5)
   - Media mentions add legitimacy

CORE REQUIREMENTS (Must have or auto-reject):
- Minimum 2 portfolio items
- Complete bio
- At least 1 social link
- Industry fit (creative/content creator field)

AUTHENTICITY CHECK (applies to all):
- Real person/company (not fake, bot, or spam)
- Consistent identity across platforms
- Professional presentation
- Red flags: Generic names, suspicious patterns, contradictions

SCORING THRESHOLDS:
- AUTO-APPROVE: 60+ points (verified creator with solid credentials)
- MANUAL REVIEW: 40-59 points (shows potential, needs human verification)
- AUTO-REJECT: <40 points (incomplete, spam, or not industry fit)

Return ONLY valid JSON (no markdown):
{
  "score": 85,
  "decision": "verify|review|reject",
  "reasoning": "2-3 sentence explanation focusing on key factors",
  "authenticity_score": 28,
  "industry_fit_score": 27,
  "quality_score": 20,
  "social_proof_score": 10,
  "red_flags": ["list any concerns or empty array"],
  "suggested_improvements": ["optional suggestions for flagged profiles"]
}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`[VERIFY-PROFILE] Starting verification for user ${user.id}`);

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
            content: "You are a professional profile verification AI. Be thorough but fair. Return only valid JSON." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[VERIFY-PROFILE] AI API error:", aiResponse.status, errorText);
      
      // Handle rate limiting gracefully
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Verification service temporarily unavailable. Your profile will be reviewed manually.",
            requiresManualReview: true 
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI verification failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || "";
    
    // Parse AI response
    let evaluation;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      evaluation = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("[VERIFY-PROFILE] AI response parsing failed:", content);
      // Default to manual review if parsing fails
      evaluation = {
        score: 60,
        decision: "review",
        reasoning: "Automated verification unavailable - profile queued for manual review",
        authenticity_score: 20,
        industry_fit_score: 20,
        quality_score: 15,
        social_proof_score: 5,
        red_flags: [],
        suggested_improvements: []
      };
    }

    // Map decision to status
    let status = "pending";
    let profileStatus = "pending";
    
    if (evaluation.decision === "verify") {
      status = "approved";
      profileStatus = "verified";
    } else if (evaluation.decision === "review") {
      status = "flagged";
      profileStatus = "flagged";
    } else {
      status = "rejected";
      profileStatus = "rejected";
    }

    // Auto-approve/reject based on score thresholds
    if (evaluation.score >= 60) {
      status = "approved";
      profileStatus = "verified";
    } else if (evaluation.score < 40) {
      status = "rejected";
      profileStatus = "rejected";
    }

    // Store verification request
    const { error: requestError } = await supabaseClient
      .from("verification_requests")
      .insert({
        user_id: user.id,
        portfolio_count: portfolioCount,
        credits_count: creditsCount,
        awards_count: awardsCount,
        press_count: pressCount,
        social_verified: socialVerified,
        ai_score: evaluation.score,
        ai_reasoning: evaluation.reasoning,
        authenticity_score: evaluation.authenticity_score,
        industry_fit_score: evaluation.industry_fit_score,
        quality_score: evaluation.quality_score,
        social_proof_score: evaluation.social_proof_score,
        status: status,
        decision: evaluation.decision,
        reviewed_at: status !== "pending" ? new Date().toISOString() : null,
      });

    if (requestError) {
      console.error("[VERIFY-PROFILE] Failed to store request:", requestError);
    }

    // Update profile verification status
    const updateData: any = {
      verification_status: profileStatus,
      verification_score: evaluation.score,
      verification_notes: evaluation.reasoning,
    };

    if (profileStatus === "verified") {
      updateData.verified_at = new Date().toISOString();
    }

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);

    if (profileError) {
      console.error("[VERIFY-PROFILE] Failed to update profile:", profileError);
      throw profileError;
    }

    console.log(`[VERIFY-PROFILE] Completed: ${user.id}, Decision: ${evaluation.decision}, Score: ${evaluation.score}`);

    return new Response(
      JSON.stringify({
        success: true,
        status: profileStatus,
        score: evaluation.score,
        reasoning: evaluation.reasoning,
        breakdown: {
          authenticity: evaluation.authenticity_score,
          industryFit: evaluation.industry_fit_score,
          quality: evaluation.quality_score,
          socialProof: evaluation.social_proof_score,
        },
        redFlags: evaluation.red_flags || [],
        suggestions: evaluation.suggested_improvements || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[VERIFY-PROFILE] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        requiresManualReview: true 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});