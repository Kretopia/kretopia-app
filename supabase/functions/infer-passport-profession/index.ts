// Infers the best Passport layout (profession archetype) for a creator profile.
// Mirrors the auto-classification pattern used by Studios (extract-brief).
//
// Input:  { profile: { full_name, role, sub_roles, bio, website, instagram_url, ... } }
// Output: { profession: ProfessionKey, confidence: number, reasoning: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH_LITE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROFESSION_KEYS = [
  "model",
  "photographer",
  "musician",
  "filmmaker",
  "designer",
  "writer",
  "creator",
  "crew",
  "default",
] as const;

const SYSTEM = `You are a creative-industry casting director. Classify a creator into ONE Passport layout archetype based on their profile.

Archetypes (pick exactly one key):
- model: Models, talent, pageant, fashion talent. Emphasizes comp card, measurements, look book.
- photographer: Photographers (fashion, editorial, wedding, commercial). Emphasizes gallery + portfolio.
- musician: Musicians, producers, singers, DJs, composers. Emphasizes releases, splits, waveform reel.
- filmmaker: Directors, cinematographers, editors, VFX, actors (screen). Emphasizes showreel + IMDb credits.
- designer: Graphic, brand, UI/UX, fashion designers, illustrators, 3D artists. Emphasizes case studies.
- writer: Writers, copywriters, journalists, screenwriters, poets. Emphasizes published work + press.
- creator: Content creators, influencers, UGC, YouTubers, TikTokers, streamers. Emphasizes social stats + brand deals.
- crew: Behind-the-scenes — stylists, MUA, hair, lighting, set, stage, production crew. Emphasizes credit list.
- default: Use ONLY when none of the above clearly fit (multi-discipline creative entrepreneurs, etc).

Return JSON: { "profession": <key>, "confidence": 0-1, "reasoning": "<one short sentence>" }`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { profile } = await req.json();
    if (!profile) {
      return new Response(JSON.stringify({ error: "profile required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Compact profile snapshot for the model
    const snapshot = {
      full_name: profile.full_name,
      role: profile.role,
      sub_roles: profile.sub_roles,
      bio: profile.bio?.slice(0, 800),
      location: profile.location,
      links: {
        website: profile.website,
        instagram: profile.instagram_url,
        youtube: profile.youtube_url,
        tiktok: profile.tiktok_url,
        spotify: profile.spotify_url,
        soundcloud: profile.soundcloud_url,
        imdb: profile.imdb_url,
        behance: profile.behance_url,
        vimeo: profile.vimeo_url,
        linkedin: profile.linkedin_url,
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH_LITE,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Profile:\n${JSON.stringify(snapshot, null, 2)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    let profession = String(parsed?.profession || "default").toLowerCase();
    if (!PROFESSION_KEYS.includes(profession as typeof PROFESSION_KEYS[number])) {
      profession = "default";
    }

    return new Response(
      JSON.stringify({
        profession,
        confidence: Number(parsed?.confidence) || 0.5,
        reasoning: String(parsed?.reasoning || ""),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[infer-passport-profession]", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
