// Studio Ingest — unified router that turns ANYTHING dropped into a Studio
// (PDF, doc, link, voice note, image, contract, deck, budget, email)
// into structured **studio_facts** + **studio_entities** (the Studio Brain).
//
// Phase B: this function is the single ingestion layer. Specialized
// downstream pipelines (elevate-brief for plans, transcribe-voice for
// audio) are still invoked from the client where useful, but EVERY drop
// flows through here so the Studio Brain stays the source of truth.
//
// Request body:
//   {
//     project_id: string,
//     source_kind: "pdf"|"image"|"voice"|"email"|"link"|"deck"|"contract"|
//                  "budget"|"brief"|"message"|"manual",
//     text?: string,             // pre-extracted text (preferred when available)
//     image_base64?: string,     // raw base64 (no data: prefix) for vision extract
//     image_mime?: string,       // e.g. "image/jpeg" (default image/jpeg)
//     image_url?: string,        // remote image url for vision extract
//     file_name?: string,
//     file_id?: string,          // project_files.id when applicable
//     url?: string,              // source URL when this is a link/asset
//     hint?: string,             // user-supplied context ("sponsor deck")
//     project_title?: string
//   }
//
// Response:
//   { ok: true, facts: N, entities: N, brain: { ... }, summary: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { wrapUntrustedContent, PROMPT_INJECTION_DEFENSE_CLAUSE } from "../_shared/promptIsolation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const ALLOWED_SOURCE_KINDS = new Set([
  "pdf", "image", "voice", "email", "link", "deck",
  "contract", "budget", "brief", "message", "manual",
]);

const ALLOWED_FACT_KINDS = new Set([
  // money
  "budget_total", "budget_line", "payment_terms", "rate", "deposit",
  "invoice_amount", "currency",
  // dates
  "event_date", "deadline", "load_in", "load_out", "doors", "show_start",
  // places
  "venue_name", "venue_address", "capacity", "city", "country",
  // people / orgs
  "client", "sponsor_tier", "contact_email", "contact_phone",
  // creative
  "key_message", "tagline", "brand_color", "asset_spec",
  // legal
  "exclusivity", "deliverable_clause", "cancellation",
  // catch-all
  "note",
]);

const ALLOWED_ENTITY_KINDS = new Set([
  "person", "org", "sponsor", "venue", "brand", "client", "talent",
  "supplier", "date", "deliverable", "product", "other",
]);

// Money/contact facts are the highest-value target for an injected
// instruction to fabricate ("wire the deposit to ...", "new contact email
// is ..."), and this Studio Brain data is read straight into later,
// higher-stakes AI calls (thrive-document-engine drafting a contract or
// invoice, desk-agent's draft_invoice tool) with no re-verification.
// "manual" is the one source_kind that's the user directly typing into
// their own Studio, not a third-party document -- everything else (pdf,
// email, link, deck, contract, budget, voice, image, message, brief) could
// easily be authored or hosted by someone other than the user. Facts of a
// sensitive kind pulled from those get a lower confidence score so a
// downstream consumer that checks it treats them as unverified rather than
// silent ground truth.
const SENSITIVE_FACT_KINDS = new Set([
  "payment_terms", "deposit", "invoice_amount", "budget_total", "budget_line",
  "rate", "contact_email", "contact_phone",
]);
const TRUSTED_SOURCE_KINDS = new Set(["manual"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "x";
}

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "record_studio_brain",
    description:
      "Extract reusable project memory from the user's dropped content. " +
      "Only return things that will be useful later when generating " +
      "proposals, decks, schedules, contracts, invoices or briefs.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-paragraph summary." },
        facts: {
          type: "array",
          description: "Atomic, reusable facts (max 24).",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                description:
                  "One of: budget_total, budget_line, payment_terms, rate, deposit, invoice_amount, currency, event_date, deadline, load_in, load_out, doors, show_start, venue_name, venue_address, capacity, city, country, client, sponsor_tier, contact_email, contact_phone, key_message, tagline, brand_color, asset_spec, exclusivity, deliverable_clause, cancellation, note.",
              },
              label: { type: "string" },
              value: { type: "string" },
              value_numeric: { type: "number" },
              value_date: { type: "string", description: "ISO yyyy-mm-dd" },
              importance: { type: "number", description: "1–5" },
              excerpt: { type: "string", description: "Quote from source ≤180 chars." },
            },
            required: ["kind", "value"],
          },
        },
        entities: {
          type: "array",
          description: "People, orgs, venues, sponsors, talent etc (max 24).",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                description: "person|org|sponsor|venue|brand|client|talent|supplier|date|deliverable|product|other",
              },
              name: { type: "string" },
              aliases: { type: "array", items: { type: "string" } },
              attrs: { type: "object" },
              importance: { type: "number" },
            },
            required: ["kind", "name"],
          },
        },
      },
      required: ["summary", "facts", "entities"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const project_id: string = String(body.project_id ?? "");
    if (!project_id) return json({ error: "project_id required" }, 400);

    const rawKind = String(body.source_kind ?? "manual").toLowerCase();
    const source_kind = ALLOWED_SOURCE_KINDS.has(rawKind) ? rawKind : "manual";
    const text: string = String(body.text ?? "").slice(0, 60_000);
    const hint: string = String(body.hint ?? "").slice(0, 400);
    const file_name: string | null = body.file_name ? String(body.file_name).slice(0, 200) : null;
    const file_id: string | null = body.file_id ? String(body.file_id) : null;
    const url: string | null = body.url ? String(body.url).slice(0, 2000) : null;
    const project_title: string = String(body.project_title ?? "this project").slice(0, 200);

    // Phase D — vision inputs (for non-text drops: images, scanned PDFs, screenshots)
    const image_base64: string | null = body.image_base64 ? String(body.image_base64) : null;
    const image_mime: string = String(body.image_mime ?? "image/jpeg").toLowerCase();
    const image_url: string | null = body.image_url ? String(body.image_url) : null;
    const hasVision = !!(image_base64 || image_url);

    // Phase D+ — audio inputs (voice notes dropped into the Studio).
    const audio_base64: string | null = body.audio_base64 ? String(body.audio_base64) : null;
    const audio_mime: string = String(body.audio_mime ?? "audio/webm").toLowerCase();
    const hasAudio = !!audio_base64;

    if (!text && !url && !hasVision && !hasAudio) {
      return json({ error: "text, url, image, or audio required" }, 400);
    }


    // Membership check (owner or collaborator)
    const { data: project } = await admin
      .from("projects")
      .select("id, created_by")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return json({ error: "project not found" }, 404);

    let isMember = project.created_by === user.id;
    if (!isMember) {
      const { data: collab } = await admin
        .from("project_collaborators")
        .select("user_id")
        .eq("project_id", project_id)
        .eq("user_id", user.id)
        .maybeSingle();
      isMember = !!collab;
    }
    if (!isMember) return json({ error: "Forbidden" }, 403);

    // -------- Ask the model to structure the drop --------
    const visionHint = hasVision
      ? " The source includes an IMAGE/SCAN — read every visible value: numbers, dates, names, line items, totals, headers, signatures, logos, addresses, contact info."
      : "";
    const audioHint = hasAudio
      ? " The source includes an AUDIO/VOICE NOTE — transcribe internally and extract any concrete plans, deadlines, dollar amounts, names, venues, sponsors mentioned. Ignore filler/'um'/small talk."
      : "";
    const systemPrompt =
      "You are the Studio Brain for an Executive Producer working on " +
      `"${project_title}". A creative just dropped a piece of source material ` +
      `(${source_kind}${file_name ? ` — ${file_name}` : ""}${hint ? `; hint: ${hint}` : ""}).` +
      visionHint + audioHint +
      " Extract ONLY the things that will be reusable later: budgets, dates, " +
      "venues, sponsors, contacts, deliverables, brand guidance, payment terms, " +
      "key messages. Be concise. Never invent. If something isn't in the source, " +
      "don't return it." +
      PROMPT_INJECTION_DEFENSE_CLAUSE;

    const userContent: any[] = [];
    if (text) userContent.push({ type: "text", text: wrapUntrustedContent(`dropped ${source_kind}`, text) });
    if (url) userContent.push({ type: "text", text: `Source URL: ${url}` });
    if (image_base64) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${image_mime};base64,${image_base64}` },
      });
    } else if (image_url) {
      userContent.push({ type: "image_url", image_url: { url: image_url } });
    }
    if (audio_base64) {
      // Gemini accepts inline audio via input_audio
      userContent.push({
        type: "input_audio",
        input_audio: { data: audio_base64, format: audio_mime.replace(/^audio\//, "") },
      });
    }
    if (!userContent.length) {
      userContent.push({ type: "text", text: `Extract anything reusable for ${project_title}.` });
    }

    // Vision/audio needs Pro for reliable extraction; text-only stays on flash for speed/cost
    const model = (hasVision || hasAudio) ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";


    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [EXTRACT_TOOL],
          tool_choice: { type: "function", function: { name: "record_studio_brain" } },
        }),
      },
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "Rate limit exceeded" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "Extraction failed" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;
    if (!args) return json({ error: "No structured output" }, 500);

    const facts: any[] = Array.isArray(args.facts) ? args.facts.slice(0, 24) : [];
    const entities: any[] = Array.isArray(args.entities) ? args.entities.slice(0, 24) : [];
    const summary: string = String(args.summary ?? "").slice(0, 800);

    // -------- Write facts --------
    const factRows = facts
      .filter((f) => f && typeof f === "object" && f.value)
      .map((f) => {
        const kind = ALLOWED_FACT_KINDS.has(String(f.kind)) ? String(f.kind) : "note";
        const importance = Math.max(1, Math.min(5, Number(f.importance ?? 3)));
        const valueDate = typeof f.value_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.value_date)
          ? f.value_date
          : null;
        const valueNum = typeof f.value_numeric === "number" && Number.isFinite(f.value_numeric)
          ? f.value_numeric
          : null;
        const confidence = SENSITIVE_FACT_KINDS.has(kind) && !TRUSTED_SOURCE_KINDS.has(source_kind)
          ? 0.4
          : 0.75;
        return {
          project_id,
          kind,
          label: f.label ? String(f.label).slice(0, 200) : null,
          value: String(f.value).slice(0, 2000),
          value_numeric: valueNum,
          value_date: valueDate,
          importance,
          confidence,
          source_kind,
          source_file_id: file_id,
          source_url: url,
          source_excerpt: f.excerpt ? String(f.excerpt).slice(0, 400) : null,
          created_by: user.id,
        };
      });

    if (factRows.length) {
      const { error: fErr } = await admin.from("studio_facts").insert(factRows);
      if (fErr) console.error("facts insert error", fErr);
    }

    // -------- Upsert entities (dedupe per project by slug) --------
    const entityRows = entities
      .filter((e) => e && typeof e === "object" && e.name)
      .map((e) => {
        const kind = ALLOWED_ENTITY_KINDS.has(String(e.kind)) ? String(e.kind) : "other";
        return {
          project_id,
          kind,
          name: String(e.name).slice(0, 200),
          slug: slugify(String(e.name)),
          aliases: Array.isArray(e.aliases) ? e.aliases.slice(0, 8).map((a: any) => String(a).slice(0, 80)) : [],
          attrs: e.attrs && typeof e.attrs === "object" ? e.attrs : {},
          importance: Math.max(1, Math.min(5, Number(e.importance ?? 3))),
          source_kind,
          source_file_id: file_id,
          source_url: url,
          created_by: user.id,
        };
      });

    if (entityRows.length) {
      const { error: eErr } = await admin
        .from("studio_entities")
        .upsert(entityRows, { onConflict: "project_id,kind,slug", ignoreDuplicates: false });
      if (eErr) console.error("entities upsert error", eErr);
    }

    return json({
      ok: true,
      facts: factRows.length,
      entities: entityRows.length,
      summary,
      brain: { facts: factRows, entities: entityRows },
    });
  } catch (e) {
    console.error("studio-ingest error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
