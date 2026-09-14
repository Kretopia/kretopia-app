import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifiedCredential {
  type: 'award' | 'credit' | 'certification' | 'social' | 'streams' | 'press';
  source: string;
  title: string;
  value?: string;
  verified: boolean;
  verifiedAt?: string;
  url?: string;
}

interface PressLink {
  id: string;
  title: string;
  url: string;
  publication?: string;
  published_date?: string;
}

interface VerificationResult {
  credentials: VerifiedCredential[];
  tier: 'verified' | 'industry' | 'elite';
  achievements: string[];
  totalScore: number;
  breakdown: {
    awards: number;
    credits: number;
    social: number;
    streams: number;
    press: number;
  };
}

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

    const body = await req.json();
    
    // Handle both call patterns:
    // 1. Direct: { profileData: { fullName, role, bio }, socialLinks }
    // 2. From Onboarding: { userId } - need to fetch profile data
    let fullName: string;
    let role: string;
    let bio: string;
    let socialLinks: Record<string, string> = {};

    if (body.profileData) {
      // Called from CredentialVerificationCard with profile data
      fullName = body.profileData.fullName || '';
      role = body.profileData.role || '';
      bio = body.profileData.bio || '';
      socialLinks = body.socialLinks || {};
    } else {
      // Called from Onboarding - fetch profile data from database
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('full_name, role, bio, spotify_url, youtube_url, imdb_url, instagram_url, linkedin_url')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        console.error('[VERIFY-CREDENTIALS] Profile fetch error:', profileError);
        return new Response(
          JSON.stringify({ 
            error: "Profile not found",
            tier: "verified"
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      fullName = profileData.full_name || '';
      role = profileData.role || '';
      bio = profileData.bio || '';
      socialLinks = {
        spotify: profileData.spotify_url || '',
        youtube: profileData.youtube_url || '',
        imdb: profileData.imdb_url || '',
        instagram: profileData.instagram_url || '',
        linkedin: profileData.linkedin_url || '',
      };
    }

    // Fetch user's press links
    const { data: pressLinks } = await supabaseClient
      .from('press_links')
      .select('id, title, url, publication, published_date')
      .eq('user_id', user.id);

    const pressLinksData = (pressLinks || []) as PressLink[];
    console.log(`[VERIFY-CREDENTIALS] Found ${pressLinksData.length} press links for user`);

    console.log(`[VERIFY-CREDENTIALS] Starting enhanced verification for ${user.id}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build comprehensive verification prompt with web search capabilities
    const verificationPrompt = `You are an advanced credential verification AI for Kretopia, a professional platform for creatives. Perform comprehensive verification of this creator's credentials.

PROFILE TO VERIFY:
- Name: ${fullName}
- Role: ${role}
- Bio: ${bio || "Not provided"}

SOCIAL PROFILES TO VERIFY:
${Object.entries(socialLinks || {})
  .filter(([_, url]) => url)
  .map(([platform, url]) => `- ${platform}: ${url}`)
  .join('\n') || 'None provided'}

PRESS & MEDIA MENTIONS TO VERIFY:
${pressLinksData.length > 0 
  ? pressLinksData.map(p => `- "${p.title}" ${p.publication ? `in ${p.publication}` : ''} - ${p.url}`).join('\n')
  : 'None provided'}

VERIFICATION TASKS:

1. **AWARD VERIFICATION** (Check for major industry awards):
   - Grammy Awards (Recording Academy)
   - Emmy Awards
   - Oscar/Academy Awards
   - Billboard Music Awards
   - MTV Awards
   - BRIT Awards
   - Cannes Lions (advertising/creative)
   - Webby Awards
   - D&AD Awards
   - BAFTA
   Look for: nominations, wins, finalist positions

2. **CREDIT VERIFICATION** (Look for professional credits):
   - IMDB credits (film, TV, music videos)
   - AllMusic credits
   - Discogs credits
   - Spotify artist profile with releases
   - Major label releases
   - Film/TV production credits
   - Published work credits

3. **SOCIAL PROOF VERIFICATION**:
   - Verified accounts (blue checkmarks)
   - Follower thresholds:
     * Instagram: 10K+ (notable), 100K+ (significant), 1M+ (major)
     * YouTube: 10K+ subscribers (notable), 100K+ (significant)
     * Spotify: 10K+ monthly listeners (notable), 100K+ (significant)
     * TikTok: 50K+ (notable), 500K+ (significant)
   - Press mentions in major publications

4. **STREAMING/ROYALTY VERIFICATION**:
   - Spotify monthly listeners
   - YouTube channel statistics
   - Apple Music presence
   - SoundCloud plays for indie artists

5. **PRESS & MEDIA VERIFICATION**:
   - Verify press links are real articles (not 404s)
   - Check publication credibility (Forbes, Billboard, Rolling Stone = high value)
   - Verify the article actually mentions the creator
   - Cross-reference with web search for additional press mentions
   - Award points based on publication tier:
     * Tier 1 (Forbes, Billboard, Rolling Stone, NYT, etc.): +15 points each
     * Tier 2 (Industry blogs, regional press): +8 points each
     * Tier 3 (Personal blogs, small publications): +3 points each

TIER CLASSIFICATION:
- **VERIFIED**: Complete profile, social links verified, professional presence
- **INDUSTRY**: Has verifiable industry credits (IMDB, label releases, agency representation)
- **ELITE**: Major awards, significant streaming numbers, or industry recognition

ACHIEVEMENT BADGES TO AWARD (only if verifiable):
- "Grammy Winner" / "Grammy Nominated"
- "Emmy Winner" / "Emmy Nominated"
- "Oscar Winner" / "Oscar Nominated"
- "Billboard Charting"
- "IMDB Credited"
- "Verified Artist" (Spotify/Apple Music verified)
- "1M+ Streams"
- "10M+ Streams"
- "100K+ Followers"
- "1M+ Followers"
- "Major Label"
- "Award Winning"
- "Published Author"
- "Festival Official Selection"
- "Featured in Forbes" (or other major publication)
- "Press Featured"

Return ONLY valid JSON:
{
  "credentials": [
    {
      "type": "award|credit|certification|social|streams|press",
      "source": "Grammy/IMDB/Spotify/Forbes/Billboard/etc",
      "title": "Specific achievement",
      "value": "Winner/Nominated/10M streams/Featured Article/etc",
      "verified": true|false,
      "url": "verification URL if found"
    }
  ],
  "tier": "verified|industry|elite",
  "achievements": ["Grammy Nominated", "IMDB Credited", "Press Featured", etc],
  "totalScore": 0-100,
  "breakdown": {
    "awards": 0-25,
    "credits": 0-25,
    "social": 0-20,
    "streams": 0-15,
    "press": 0-15
  },
  "reasoning": "Brief explanation of verification findings"
}`;

    // Call AI with web search context
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
            content: `You are a credential verification specialist. Research the person's public credentials thoroughly. 
            Be conservative - only mark something as "verified": true if you can confirm it exists.
            For social links, extract follower counts and verification status if visible in the URL patterns.
            Return only valid JSON.` 
          },
          { role: "user", content: verificationPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[VERIFY-CREDENTIALS] AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Verification service temporarily unavailable",
            fallbackTier: "verified"
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI verification failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || "";
    
    let result: VerificationResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("[VERIFY-CREDENTIALS] Parse error:", content);
      result = {
        credentials: [],
        tier: "verified",
        achievements: [],
        totalScore: 50,
        breakdown: { awards: 0, credits: 0, social: 25, streams: 0, press: 0 }
      };
    }

    // Ensure press is in breakdown (backwards compatibility)
    if (!result.breakdown.press) {
      result.breakdown.press = 0;
    }

    // Store verified credentials in database
    const verifiedCredentials = result.credentials.filter(c => c.verified);
    
    // Update profile with verified achievements (always update, even with 0 credentials)
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        verified_credentials: verifiedCredentials,
        verification_tier: result.tier,
        achievement_badges: result.achievements,
        verification_score: result.totalScore,
        verification_breakdown: result.breakdown,
        verification_status: result.tier === 'elite' ? 'elite_verified' : 
                            result.tier === 'industry' ? 'industry_verified' : 'verified',
        verified_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[VERIFY-CREDENTIALS] Update error:", updateError);
    }

    // Log verification request
    await supabaseClient
      .from("verification_requests")
      .insert({
        user_id: user.id,
        ai_score: result.totalScore,
        ai_reasoning: JSON.stringify(result),
        status: result.tier === 'elite' ? 'elite' : result.tier === 'industry' ? 'industry' : 'verified',
        decision: 'verify',
        reviewed_at: new Date().toISOString()
      });

    console.log(`[VERIFY-CREDENTIALS] Completed: ${user.id}, Tier: ${result.tier}, Achievements: ${result.achievements.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[VERIFY-CREDENTIALS] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
