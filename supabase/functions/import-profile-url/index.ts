import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the page content
    let pageContent = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ThriveIN/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // Extract text content — strip HTML tags
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000); // Limit context
    } catch (e) {
      return new Response(JSON.stringify({ error: "Could not fetch that URL. Check it's publicly accessible." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Extract professional profile information from this web page content. The URL is: ${url}

Page content:
${pageContent}

Extract and return ONLY valid JSON (no markdown, no code blocks) with these fields:
{
  "full_name": "the person's name or null",
  "role": "their primary professional title/role or null",
  "bio": "a brief professional bio based on their page, 2-3 sentences, or null",
  "location": "their location if mentioned or null",
  "skills": ["array of skills/specialties mentioned"],
  "credits": [
    {"project_name": "name", "role": "their role", "project_type": "film|music|tv|commercial|theater|podcast|other", "year": 2024}
  ]
}

For LinkedIn profiles, extract headline as role, summary as bio basis, and experience as credits.
For IMDb profiles, extract filmography as credits.
For portfolio/personal sites, extract whatever professional info is available.
Keep credits to the top 5 most notable.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI request failed: ${aiRes.status}`);
    }

    const data = await aiRes.json();
    let raw = data.choices?.[0]?.message?.content?.trim() || "{}";
    
    // Strip markdown code blocks if present
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    
    let profile;
    try {
      profile = JSON.parse(raw);
    } catch {
      profile = { error: "Could not parse profile data from that page" };
    }

    return new Response(JSON.stringify(profile), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-profile-url error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
