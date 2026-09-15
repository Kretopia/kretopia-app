import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH, GEMINI_FLASH_IMAGE } from "../_shared/aiModels.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const rateLimit = await checkAiFeatureRateLimit(supabase, user.id, "extract-event-details");
    if (!rateLimit.allowed) return rateLimit.response;

    const body = await req.json().catch(() => ({}));
    const { text, image_base64, image_mime_type, source_platform, source_url, extract_only } = body as {
      text?: string;
      image_base64?: string;
      image_mime_type?: string;
      source_platform?: string;
      source_url?: string;
      /** When true, only return extracted JSON — do NOT create an unclaimed event row or generate a cover. Used by the host create-flow flyer scanner. */
      extract_only?: boolean;
    };

    if (!text && !image_base64 && !source_url) {
      return json({ error: "Provide text, screenshot, or a URL" }, 400);
    }

    // 1. If URL provided, try to scrape its visible text (best-effort).
    let scrapedText = "";
    if (source_url) {
      // 1a. Try a plain fetch first (fast, free).
      try {
        const r = await fetch(source_url, {
          headers: { "User-Agent": "Mozilla/5.0 ThriveINBot/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (r.ok) {
          const html = await r.text();
          scrapedText = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
        }
      } catch (e) {
        console.warn("Raw fetch failed (non-fatal):", e);
      }

      // 1b. If the page is a JS SPA (sparse text or missing date/time signals), fall back to Firecrawl.
      const looksSparse =
        scrapedText.length < 400 ||
        !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[:\.]\d{2})\b/i.test(
          scrapedText,
        );
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (looksSparse && FIRECRAWL_API_KEY) {
        try {
          const fcResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: source_url,
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 1500,
              timeout: 20000,
            }),
            signal: AbortSignal.timeout(25000),
          });
          if (fcResp.ok) {
            const fcData = await fcResp.json();
            const md = fcData?.data?.markdown || "";
            if (md && md.length > scrapedText.length) {
              scrapedText = md.slice(0, 8000);
              console.log("Firecrawl scrape succeeded, length:", scrapedText.length);
            }
          } else {
            console.warn("Firecrawl returned non-OK:", fcResp.status);
          }
        } catch (e) {
          console.warn("Firecrawl fallback failed (non-fatal):", e);
        }
      }
    }

    const combinedText = [text, scrapedText].filter(Boolean).join("\n\n");

    // 2. AI extraction
    const nowIso = new Date().toISOString();
    const systemPrompt = `You extract structured EVENT details from flyers, posters, social posts, or web pages.

Today is ${nowIso}. Use this as your reference when resolving relative or partial dates.

Read every detail carefully — date, time, venue, ticket info, host name, what attendees should expect.

DATE & TIME RULES (critical — get these right):
1. If a year is missing, pick the NEXT future occurrence of that month/day relative to today. Never default to the current year if that date has already passed.
2. If a weekday is given alongside a date (e.g. "May 1, Friday"), verify the weekday matches the year you chose. If it does not match the current year, advance the year until it does.
3. Times like "7:30", "07:30", "8 - 11" on a social/meetup/nightlife page nearly always mean PM/evening. Treat ambiguous single-digit or sub-12 times as PM unless the context (brunch, breakfast, morning workshop) clearly indicates AM.
4. Always anchor times to the venue's local timezone (IANA), then convert to a proper ISO 8601 string with offset. Example: an event at 7:30pm in Canggu, Bali → "2026-05-01T19:30:00+08:00", timezone "Asia/Makassar".
5. If a range is given ("07:30 - 11:59"), populate both start_time and end_time.
6. Only return null for start_time if there is genuinely no date information at all.

For the "description" field, do NOT just copy the raw text. Rewrite it as a polished, engaging event listing — clear, professional, and inviting. Use proper line breaks. Keep it 2-4 short paragraphs.

Return ONLY a JSON object with these fields:
- title: string (clean, properly capitalized)
- description: string (polished, rewritten — not the raw post)
- category: string or null (e.g. "music", "film", "networking", "workshop", "fashion", "art", "tech", "other")
- venue_name: string or null
- venue_address: string or null
- country: string or null (full country name if identifiable)
- start_time: string ISO 8601 with offset (e.g. "2026-05-01T19:30:00+08:00")
- end_time: string ISO 8601 with offset, or null
- timezone: string IANA (e.g. "Asia/Makassar", "America/Port_of_Spain") — required when you return a start_time
- max_participants: integer (default 100 if not stated)
- is_ticketed: boolean
- ticket_price: number or null (numeric only)
- ticket_currency: string ISO code or null (e.g. "USD", "TTD")
- external_ticket_url: string URL or null (if a ticket link is visible)
- tags: string[] (3-6 relevant tags)
- cover_image_prompt: string (a clean visual prompt describing the vibe/mood for a 16:9 banner — no text in the image)

If a field truly has no signal, use null. Never invent prices or venues.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (image_base64) {
      const safeMimeType = typeof image_mime_type === "string" && /^image\/[a-z0-9.+-]+$/i.test(image_mime_type)
        ? image_mime_type
        : "image/jpeg";
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: combinedText
              ? `Extract event details from this image and the text below.\n\n${combinedText}`
              : "Extract event details from this image.",
          },
          { type: "image_url", image_url: { url: `data:${safeMimeType};base64,${image_base64}` } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Extract event details from the following scraped page content. Pay special attention to:\n- Date fragments split across separate lines (e.g. month, day, weekday on different lines — combine them).\n- Time ranges like "07:30 - 11:59" — these mean evening (19:30 - 23:59 local time).\n- Venue name and city/country — often appears as a short line right after the time, sometimes with a flag emoji (e.g. "🇮🇩Canggu" → city Canggu, country Indonesia → timezone Asia/Makassar).\n\nContent:\n\n${combinedText}`,
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) return json({ error: "Rate limited, please try again shortly" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: `AI extraction failed (${aiResp.status})` }, 500);
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content;
    if (!raw) return json({ error: "AI returned no content" }, 500);

    let extracted: any;
    try {
      extracted = JSON.parse(raw);
    } catch {
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) extracted = JSON.parse(m[1].trim());
      else return json({ error: "Could not parse AI response" }, 500);
    }

    // Sanitize numeric/date fields
    const safeNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const ticketPrice = safeNum(extracted.ticket_price);
    const maxP = Number.isFinite(Number(extracted.max_participants))
      ? Math.max(1, Math.min(10000, Math.floor(Number(extracted.max_participants))))
      : 100;

    let startTime = extracted.start_time;
    if (!startTime || isNaN(new Date(startTime).getTime())) {
      // Default to 7 days from now at 7pm UTC if AI couldn't read a date
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 7);
      d.setUTCHours(19, 0, 0, 0);
      startTime = d.toISOString();
    }
    const endTime = extracted.end_time && !isNaN(new Date(extracted.end_time).getTime())
      ? extracted.end_time
      : null;

    const coverPrompt = extracted.cover_image_prompt;
    delete extracted.cover_image_prompt;

    // Early return for the host create-flow flyer scanner: extraction only, no DB writes / no AI cover.
    if (extract_only) {
      return json({ success: true, extracted, has_cover_image: false });
    }

    // 3. Generate cover image (best-effort)
    let coverImageUrl: string | null = null;
    try {
      const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_FLASH_IMAGE,
          messages: [
            {
              role: "user",
              content: `Create a clean, modern 16:9 banner image for an event listing. ${coverPrompt || extracted.title}. No text or words in the image. Cinematic, professional, suitable as a cover.`,
            },
          ],
          modalities: ["image", "text"],
        }),
      });
      if (imgResp.ok) {
        const imgData = await imgResp.json();
        const dataUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (dataUrl) {
          const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
          const fileName = `event-covers/${crypto.randomUUID()}.png`;
          const { error: uploadErr } = await supabase.storage
            .from("event-covers")
            .upload(fileName, bytes, { contentType: "image/png", upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("event-covers").getPublicUrl(fileName);
            coverImageUrl = urlData?.publicUrl || null;
          } else {
            // Fall back to opportunities bucket if event-covers doesn't exist
            const { error: fallbackErr } = await supabase.storage
              .from("opportunities")
              .upload(fileName, bytes, { contentType: "image/png", upsert: true });
            if (!fallbackErr) {
              const { data: urlData } = supabase.storage.from("opportunities").getPublicUrl(fileName);
              coverImageUrl = urlData?.publicUrl || null;
            }
          }
        }
      }
    } catch (e) {
      console.warn("cover image gen failed (non-fatal):", e);
    }

    // 4. Create unclaimed event
    const claimToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const insertRow: any = {
      title: extracted.title || "Untitled event",
      description: extracted.description || null,
      category: extracted.category || null,
      venue_name: extracted.venue_name || null,
      venue_address: extracted.venue_address || null,
      country: extracted.country || null,
      start_time: startTime,
      end_time: endTime,
      timezone: extracted.timezone || null,
      max_participants: maxP,
      is_ticketed: !!extracted.is_ticketed,
      ticket_price: ticketPrice,
      ticket_currency: extracted.ticket_currency || null,
      external_ticket_url: extracted.external_ticket_url || null,
      tags: Array.isArray(extracted.tags) ? extracted.tags.slice(0, 8) : null,
      is_public: true,
      status: "upcoming",
      created_by: user.id,
      scouted_by: user.id,
      claim_token: claimToken,
      claim_status: "unclaimed",
      source_platform: source_platform || (source_url ? "url" : "unknown"),
      source_url: source_url || null,
      original_source_text: text || (source_url ? `URL: ${source_url}` : "Screenshot upload"),
      ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
    };

    // If this user already scouted this exact URL, return the existing event instead of creating a duplicate.
    if (source_url) {
      const { data: existing } = await supabase
        .from("creative_jams")
        .select("id, claim_token, title")
        .eq("scouted_by", user.id)
        .eq("source_url", source_url)
        .maybeSingle();
      if (existing) {
        return json({
          success: true,
          event: existing,
          extracted,
          has_cover_image: !!coverImageUrl,
          already_scouted: true,
        });
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("creative_jams")
      .insert(insertRow)
      .select("id, claim_token, title")
      .single();

    if (insErr) {
      // Race condition: another request inserted first — fetch and return it.
      if (insErr.code === "23505" && source_url) {
        const { data: existing } = await supabase
          .from("creative_jams")
          .select("id, claim_token, title")
          .eq("scouted_by", user.id)
          .eq("source_url", source_url)
          .maybeSingle();
        if (existing) {
          return json({ success: true, event: existing, extracted, has_cover_image: !!coverImageUrl, already_scouted: true });
        }
      }
      console.error("Insert error:", insErr);
      return json({ error: `Failed to create event: ${insErr.message}` }, 500);
    }

    return json({
      success: true,
      event: inserted,
      extracted,
      has_cover_image: !!coverImageUrl,
    });
  } catch (e) {
    console.error("extract-event-details error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
