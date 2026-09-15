// Producer's Clip Generator + Sponsor Match
// Backwards-compatible with existing EpisodeDetailDialog caller.
// Input: { transcript | transcript_excerpt: string, episode_title?: string, guest_names?: string[], max_clips?: number }
// Output: {
//   clips: [{ title, excerpt, hook, caption, captions: { instagram, tiktok, twitter }, hashtags[], start_seconds, end_seconds }],
//   sponsors: [{ label, why }]
// }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `You are "Producer", Kretopia's clip-generation specialist for creators.
Given a podcast/video transcript, propose 3-5 short, scroll-stopping clips for social.

Each clip MUST include:
- title: 4-8 word internal label
- excerpt: 1-3 sentences pulled (or lightly paraphrased) from the transcript that form the clip
- hook: the 1-line scroll-stopper (no clickbait, no emojis)
- start_seconds, end_seconds: rough timestamps estimated by transcript position (clip 25-75s long)
- captions: object with platform-specific captions:
    - "instagram": 1-2 sentences + line break + 5 hashtags
    - "tiktok": 1 short punchy line + 3 hashtags
    - "twitter": <=240 chars
- hashtags: array of 4-7 hashtags WITHOUT the # symbol

If sponsors/vendors are provided in user memory, suggest 1-3 best fits in "sponsors" with a 1-sentence "why".

Output STRICT JSON ONLY:
{
  "clips": [{
    "title": string,
    "excerpt": string,
    "hook": string,
    "start_seconds": number,
    "end_seconds": number,
    "captions": { "instagram": string, "tiktok": string, "twitter": string },
    "hashtags": string[]
  }],
  "sponsors": [{ "label": string, "why": string }]
}
No prose, no markdown, JSON only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const transcript: string = (body?.transcript ?? body?.transcript_excerpt ?? "").toString();
    const episodeTitle: string = (body?.episode_title || "").toString();
    const guestNames: string[] = Array.isArray(body?.guest_names) ? body.guest_names : [];
    const maxClips: number = Math.min(Math.max(Number(body?.max_clips) || 4, 2), 6);

    if (!transcript || transcript.trim().length < 80) {
      return json({ error: "Transcript too short. Need at least a paragraph." }, 400);
    }

    // Pull sponsor/vendor memory (best-effort)
    let memorySummary = "";
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
      const auth = req.headers.get("Authorization") || "";
      if (auth) {
        const userClient = createClient(SUPABASE_URL, ANON, {
          global: { headers: { Authorization: auth } },
        });
        const { data: u } = await userClient.auth.getUser();
        if (u?.user?.id) {
          const { data: mems } = await userClient
            .from("thrive_memory")
            .select("kind, label, body")
            .eq("user_id", u.user.id)
            .in("kind", ["sponsor", "vendor", "brand"])
            .order("importance", { ascending: false })
            .limit(12);
          if (mems?.length) {
            memorySummary =
              "\nUser's known sponsors/vendors (suggest matches when relevant):\n" +
              mems.map((m: any) => `- ${m.label}${m.body ? ": " + m.body : ""}`).join("\n");
          }
        }
      }
    } catch (e) {
      console.warn("[generate-clips] memory fetch", e);
    }

    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_KEY) return json({ error: "AI gateway not configured" }, 500);

    const userPrompt = `Episode: ${episodeTitle || "(untitled)"}${guestNames.length ? `\nGuests: ${guestNames.join(", ")}` : ""}
Generate up to ${maxClips} clips.${memorySummary}

TRANSCRIPT:
${transcript.slice(0, 18000)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) return json({ error: "Rate limited, try again soon" }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `AI error: ${t.slice(0, 300)}` }, 500);
    }

    const ai = await resp.json();
    const content = ai?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Normalize: ensure each clip has the back-compat fields
    const rawClips = Array.isArray(parsed?.clips) ? parsed.clips.slice(0, maxClips) : [];
    const clips = rawClips.map((c: any) => ({
      title: c.title || c.hook || "Clip",
      excerpt: c.excerpt || c.transcript_excerpt || "",
      hook: c.hook || c.title || "",
      start_seconds: typeof c.start_seconds === "number" ? c.start_seconds : null,
      end_seconds: typeof c.end_seconds === "number" ? c.end_seconds : null,
      captions: c.captions && typeof c.captions === "object" ? c.captions : { instagram: c.caption || "", tiktok: c.caption || "", twitter: c.caption || "" },
      hashtags: Array.isArray(c.hashtags) ? c.hashtags.map((h: string) => h.replace(/^#/, "")) : [],
    }));
    const sponsors = Array.isArray(parsed?.sponsors) ? parsed.sponsors.slice(0, 6) : [];

    return json({ clips, sponsors });
  } catch (e) {
    console.error("[generate-clips]", e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
