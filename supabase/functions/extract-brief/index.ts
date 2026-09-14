// Extracts structured deliverables from any brief source:
//  - text:    free-form text the user typed
//  - csv:     pasted CSV / Excel-exported rows
//  - sheet:   public Google Sheet URL (uses Sheets API v4 public endpoint w/ no key via export?format=csv)
//  - doc:     base64-encoded PDF / image / docx (Gemini multimodal)
//  - audio:   base64-encoded voice recording (Gemini multimodal)
//
// Output is always the same shape: { project: { title, summary }, deliverables: [...] }
// so the frontend can review and bulk-insert into project_deliverables.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Source = "text" | "csv" | "sheet" | "doc" | "audio";

interface MoodboardItem {
  url: string;                 // link to image, Pinterest, IG, Behance, Drive, etc.
  thumbnail_url?: string | null; // direct image URL if known (used for card preview)
  caption?: string | null;
  kind?: "image" | "link" | "video" | null;
}

interface DeliverableOut {
  title: string;
  description?: string;
  due_date?: string | null; // ISO date
  reference_url?: string | null;        // legacy single ref (kept for back-compat)
  references?: MoodboardItem[];         // NEW: full moodboard
  notes?: string | null;
}

interface BriefOut {
  project: { title: string; summary: string };
  deliverables: DeliverableOut[];
}

// Kept in sync by hand with src/lib/workspaceConfigs.ts's WorkspaceType --
// there is no shared import between the Vite app and a Deno edge function,
// so this list is the second copy of that enum by necessity. Previously
// this used a completely different 7-value vocabulary (podcast/event/
// content/campaign/music/client/general) that didn't match any of the
// app's real 11 workspace types except "general" -- every real project
// type silently fell back to the generic persona below, regardless of
// what kind of project it actually was. "podcast" and "client" are kept
// as extra recognized aliases (podcast folds into content_series, per
// workspaceConfigs.ts's own "Podcast, YouTube series, IG/TikTok content"
// description) in case anything still sends them.
type WorkspaceType =
  | "photo_shoot" | "video_shoot" | "music_project" | "fashion_show"
  | "event_production" | "commissioned_art" | "brand_collab" | "dj_live_gig"
  | "edit_job" | "content_series" | "general" | "podcast" | "client";

const PERSONAS: Record<WorkspaceType, { role: string; lens: string; example: string }> = {
  photo_shoot: {
    role: "a senior photo producer who has run editorial, commercial and lifestyle shoots",
    lens: "Think call sheet, shot list, location/permits, talent and glam booking, lighting notes, and the selects-to-retouch pipeline.",
    example: 'Lock shoot date & location, build shot list, confirm talent + glam, scout/confirm permits, build call sheet, shoot day, cull to selects, send for retouch, deliver final retouched set.',
  },
  video_shoot: {
    role: "a senior film/video producer who has run music videos, shorts, commercials and docs",
    lens: "Think treatment, scene/shot breakdown, crew and cast, call sheet, equipment list, shoot days, and the edit milestone chain to final export.",
    example: "Lock treatment & scenes, confirm crew + cast, build call sheet, shoot day(s), assemble rough cut, client/self review, picture lock, color & sound, deliver final exports.",
  },
  music_project: {
    role: "an A&R / release manager",
    lens: "Think writing & production, stems, mix, master, artwork, splits, distribution, pre-save, press kit, release-day promo.",
    example: "Lock final mix, deliver master, finalize artwork, register splits, distribute via partner, pre-save campaign, press kit, release-day socials.",
  },
  fashion_show: {
    role: "a fashion show producer who has run runway shows and lookbook drops",
    lens: "Think model casting and lineup, looks and changes, run-of-show, backstage roll call, glam call times, and vendor/venue coordination.",
    example: "Finalize model lineup, confirm looks per model, map backstage changes, build runway run of show, confirm glam call times, day-of backstage lead, post-show recap assets.",
  },
  event_production: {
    role: "a senior event producer who has run festivals, conferences, brand activations and weddings",
    lens: "Think like a producer: venue & vendor lock, run-of-show, talent/lineup, sponsors, marketing & comms, ticketing/RSVP, content capture, day-of logistics, post-event recap.",
    example: 'For "Bali Carnival" you would draft: "Lock concept & creative direction", "Scout & confirm venue/site permits", "Book lineup (DJs, performers, hosts)", "Confirm key vendors (stage, sound, lights, security)", "Build run-of-show document", "Open RSVP/ticketing & launch comms", "Sponsor outreach pack", "Content & social capture plan", "Day-of crew brief", "Post-event recap & thank-yous".',
  },
  commissioned_art: {
    role: "a producer managing a commissioned art piece (illustration, design, painting, custom work)",
    lens: "Think concept rounds, sketch/mockup approval, milestone check-ins, revision tracking, licensing/usage terms, and final handoff packaging.",
    example: "Confirm concept & size, share initial sketch/mockup, get direction approved, work-in-progress check-in, revision round, final approval, package final files for handoff.",
  },
  brand_collab: {
    role: "a creator-brand collaboration manager running sponsored content and UGC deals",
    lens: "Think brief alignment, usage rights, deliverable tracking (per platform/format), approval rounds, and payment milestones.",
    example: "Confirm brief & usage rights, draft content concepts, submit first cut, revision round, secure final approval, deliver final assets, send invoice.",
  },
  dj_live_gig: {
    role: "a producer managing a DJ set or live performance gig",
    lens: "Think set time and tech rider, setlist, load-in/out logistics, payment terms, and post-gig recap content.",
    example: "Confirm set time & rider, build setlist, confirm load-in time, confirm payment terms, day-of set, upload recap clips, send invoice.",
  },
  edit_job: {
    role: "a post-production editor managing a photo retouch, video edit or audio mix job",
    lens: "Think raw asset ingestion and organization, version control, revision rounds against reference, and final delivery in the right formats.",
    example: "Collect raw footage/photos + references, create first pass, send review link, revision round, second review, export final deliverables in requested formats.",
  },
  content_series: {
    role: "an executive producer for an ongoing content series (podcast, YouTube series, or IG/TikTok content)",
    lens: "Think episode/entry planning, guest or topic research, production calendar, batch recording, edit pass, thumbnails/cover art, and publishing cadence.",
    example: "Outline episodes/entries, book guests or lock topics, build production calendar, batch-record assets, edit pass, design thumbnails/cover art, schedule publishing, extract social clips.",
  },
  podcast: {
    role: "an executive podcast producer",
    lens: "Think guest research, outreach + booking, prep doc, recording session, edit, show notes, cover art, episode publish, clip extraction for socials, sponsor outreach.",
    example: "Confirm guest, send prep doc, record episode, rough cut, final mix, write show notes, design cover, schedule release, generate 3-5 social clips.",
  },
  client: {
    role: "a producer running a paid client engagement",
    lens: "Think scope, kickoff, milestone deliverables, review cycles, final delivery, invoicing.",
    example: "Kickoff call, milestone 1, internal QA, client review, revisions, final delivery, send invoice.",
  },
  general: {
    role: "a senior creative producer",
    lens: "Break the work into the obvious next steps a creative would take from idea to delivery.",
    example: "Lock concept, gather references, draft, review, refine, ship.",
  },
};

const buildSystemPrompt = (type: WorkspaceType) => {
  const p = PERSONAS[type] ?? PERSONAS.general;
  return `You are ${p.role}. A creative founder is starting a new project and may have given you only a phrase or two — your job is to RESEARCH AND ELEVATE it into a real production plan.

${p.lens}

Concrete example of the depth expected: ${p.example}

Output STRICT JSON matching this TypeScript type:
{
  "project": { "title": string, "summary": string },
  "deliverables": Array<{
    "title": string,
    "description": string,
    "due_date": string | null,
    "references": Array<{
      "url": string,
      "thumbnail_url": string | null,
      "caption": string | null,
      "kind": "image" | "link" | "video" | null
    }>,
    "notes": string | null
  }>
}

Rules:
- ALWAYS return 5-8 deliverables for this kind of project. Even if the user only typed two words, infer the full production arc and lay it out chronologically (pre-production → production → post → delivery → promo/recap).
- The "summary" field should be 2-4 sentences that ELEVATE the original input — give it a real creative direction, audience, tone, and success vision. Don't just echo what the user typed.
- "title" can be polished but keep the user's name if they gave one.
- Each deliverable description is 1-3 sentences, concrete and actionable. Tailor language to the medium.
- If the source is a spreadsheet, treat each ROW as one deliverable. Map columns intelligently (Title/Name/Asset → title; Description/Brief/Notes → description; Due/Deadline → due_date; Reference/Link/Inspo/Moodboard/Image → references[]).
- If a single cell contains multiple URLs, split them.
- A URL ending in .jpg/.jpeg/.png/.webp/.gif → set thumbnail_url to the same URL, kind="image".
- youtube.com/youtu.be/vimeo.com → kind="video", thumbnail_url=null.
- Otherwise kind="link", thumbnail_url=null.
- Never invent references that aren't in the source.
- Keep titles under 80 chars.
- Return ONLY the JSON object, no prose, no markdown fences.
${PROMPT_INJECTION_DEFENSE_CLAUSE}`;
};

async function fetchPublicSheetAsCsv(url: string): Promise<string> {
  // Convert any Google Sheets URL into the CSV export endpoint.
  // Works for "anyone with link can view" sheets without OAuth.
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Not a valid Google Sheets URL");
  const id = match[1];
  const gidMatch = url.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error(
      `Could not read the sheet (status ${res.status}). Make sure it is shared as "Anyone with the link — Viewer".`,
    );
  }
  return await res.text();
}

async function callGemini(parts: unknown[], systemPrompt: string, apiKey: string): Promise<BriefOut> {
  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!res.ok) {
    // Friendlier copy for the two AI-gateway failure modes a user can
    // actually do something about -- everything else stays a generic
    // "AI gateway error N: ..." (still real, just not actionable by the
    // user). Same two cases scope-guardian already special-cases.
    if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings.");
    const text = await res.text();
    throw new Error(`AI gateway error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  let parsed: BriefOut;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch (_e) {
    throw new Error("AI returned invalid JSON");
  }
  if (!parsed?.deliverables || !Array.isArray(parsed.deliverables)) {
    throw new Error("AI response missing deliverables array");
  }
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth fix (STUDIO_OVERHAUL_V2_AUDIT.md security risk #1): this function
    // had no authentication at all -- anyone with the public anon key could
    // invoke Kreto's AI brief-drafting directly, off-platform, for free.
    // It persists nothing itself (the frontend does all DB writes after
    // review), so this is a cost/abuse control, not a data-authorization
    // fix, but it's still real callers only from here on.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const source: Source = body.source;
    const projectTitle: string | undefined = body.project_title;
    const rawType = (body.workspace_type ?? "general") as string;
    const workspaceType: WorkspaceType = (
      Object.keys(PERSONAS).includes(rawType) ? rawType : "general"
    ) as WorkspaceType;
    const systemPrompt = buildSystemPrompt(workspaceType);

    if (!source) {
      return new Response(JSON.stringify({ error: "source is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parts: unknown[] = [];
    const ctx = projectTitle ? `Existing project title (for context): "${projectTitle}".\n\n` : "";

    if (source === "text") {
      const text: string = body.text ?? "";
      if (!text.trim()) throw new Error("text is required for source=text");
      parts = [{ type: "text", text: `${ctx}Brief (free-form):\n\n${wrapUntrustedContent("user-provided brief text", text)}` }];
    } else if (source === "csv") {
      const csv: string = body.csv ?? "";
      if (!csv.trim()) throw new Error("csv is required for source=csv");
      parts = [{
        type: "text",
        text: `${ctx}Brief delivered as CSV/spreadsheet rows. Treat each row (after the header) as ONE deliverable:\n\n${wrapUntrustedContent("pasted CSV", csv)}`,
      }];
    } else if (source === "sheet") {
      const url: string = body.url ?? "";
      if (!url) throw new Error("url is required for source=sheet");
      const csv = await fetchPublicSheetAsCsv(url);
      parts = [{
        type: "text",
        text: `${ctx}Brief delivered as a public Google Sheet (exported to CSV). Treat each row as ONE deliverable:\n\n${wrapUntrustedContent("Google Sheet export", csv)}`,
      }];
    } else if (source === "doc") {
      const dataBase64: string = body.data_base64 ?? "";
      const mimeType: string = body.mime_type ?? "application/pdf";
      if (!dataBase64) throw new Error("data_base64 is required for source=doc");
      parts = [
        {
          type: "text",
          text: `${ctx}Brief delivered as an uploaded document. Extract all deliverables from it.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${dataBase64}` },
        },
      ];
    } else if (source === "audio") {
      const dataBase64: string = body.data_base64 ?? "";
      const mimeType: string = body.mime_type ?? "audio/webm";
      if (!dataBase64) throw new Error("data_base64 is required for source=audio");
      parts = [
        {
          type: "text",
          text: `${ctx}Brief delivered as a voice memo. Transcribe and extract deliverables.`,
        },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${dataBase64}` },
        },
      ];
    } else {
      throw new Error(`Unknown source: ${source}`);
    }

    const result = await callGemini(parts, systemPrompt, LOVABLE_API_KEY);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("extract-brief error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
