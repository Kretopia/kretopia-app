// Thrive Executive Producer — document engine (Phase 1: EP Design Engine).
// Pipeline:  Brief → Content Strategy → Brand → Audience → Visual Direction →
//            Layout Selection → Image Selection → Render → Self-Critique.
// One engine, many intents. Output is presentation-quality, send-ready.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Intent =
  | "sponsor_deck"
  | "pitch_deck"
  | "business_plan"
  | "client_proposal"
  | "treatment"
  | "rate_card"
  | "moodboard_deck"
  | "one_pager"
  | "letter_of_intent";

const INTENT_SKELETONS: Record<Intent, { slides: string[]; tone: string }> = {
  sponsor_deck: {
    tone: "Confident, partner-focused. Lead with audience value to the sponsor, not features of the event.",
    slides: ["Cover", "The Moment (why now)", "Who's in the room (audience)", "What we're building", "Sponsor tiers & activations", "Past wins (credits + co-signs)", "Team", "The ask", "Contact"],
  },
  pitch_deck: {
    tone: "Investor-grade but human. Show traction, team, opportunity.",
    slides: ["Cover", "Problem", "Solution", "How it works", "Market", "Traction", "Business model", "Why us (team + credits)", "Roadmap", "The ask", "Contact"],
  },
  business_plan: {
    tone: "Strategic, structured, numbers-forward.",
    slides: ["Executive Summary", "Vision & Mission", "Market Opportunity", "Product / Service", "Go-to-market", "Operations", "Team", "Financial Projections", "Milestones", "Funding Ask", "Appendix"],
  },
  client_proposal: {
    tone: "Warm, specific to the client. Show you understand their goal first, then sell the plan.",
    slides: ["Cover", "What you're trying to do", "Our take", "What we'll deliver", "Timeline", "Investment", "Why us (relevant credits)", "Next steps"],
  },
  treatment: {
    tone: "Cinematic, sensory, visual-first. Director's voice.",
    slides: ["Cover (logline)", "The world", "Story / arc", "Visual references", "Sound & tone", "Cast & key crew", "Schedule + locations", "Director's note"],
  },
  rate_card: {
    tone: "Clear, premium, no apologies. Anchor packages, not hourly.",
    slides: ["Cover", "How I work", "Packages", "Add-ons", "What's included / not", "Recent clients", "Contact"],
  },
  moodboard_deck: {
    tone: "Image-first. One idea per slide. Minimal text.",
    slides: ["Cover concept", "Mood 1", "Mood 2", "Mood 3", "Mood 4", "Mood 5", "Palette & type", "Closing image"],
  },
  one_pager: {
    tone: "Single dense page. Hook, value, proof, ask.",
    slides: ["One Pager"],
  },
  letter_of_intent: {
    tone: "Formal business letter on branded letterhead. Warm but professional. First person. No marketing fluff. Reads like a real letter a senior producer would send — recipient name, clear intent, terms, signature line. Use the brand's letterhead (logo + name + tagline appear via the renderer).",
    slides: [
      "Letterhead Cover (recipient block + date + subject line, NO body)",
      "Letter Body (Dear [Recipient], 3-5 short paragraphs: intent, scope, key terms/timeline, ask, close. End with 'Sincerely,' + sender name & title.)",
      "Terms & Next Steps (brief bullets: scope, exclusivity, validity, signatures required)",
    ],
  },
};

const COVER_STYLES: Record<Intent, string> = {
  sponsor_deck:    "Bold editorial poster. Crowd / event energy, cinematic lighting, large brand-safe negative space top-left for title. No stock-photo vibe.",
  pitch_deck:      "Clean, premium tech-editorial. Single hero object or abstract gradient field. Confident, calm, investor-grade.",
  business_plan:   "Minimal corporate cover. Architectural lines, subdued palette, one strong focal mark. Serious, document-like.",
  client_proposal: "Warm, human, on-brand. Subject matter that mirrors the client's world. Soft natural light. Feels personal, not templated.",
  treatment:       "Cinematic film still. Strong subject, shallow depth, mood and palette do the talking. Letterboxed feel.",
  rate_card:       "Premium minimalist. Single object or texture on rich background. Reads like a luxury services menu cover.",
  moodboard_deck:  "Pure image. No text intent. Striking single frame that sets the entire creative direction.",
  one_pager:       "Magazine-cover composition. Strong typography zone + one hero visual. High-contrast, scannable.",
  letter_of_intent:"Branded letterhead — solid colour or subtle paper texture. Logo lockup top, signature block bottom. No imagery in the body.",
};

const THEME_HINTS: Record<string, string> = {
  editorial:  "Editorial magazine feel. Generous margins, refined typography zone.",
  bold:       "Brutalist, high-contrast, oversized type zone, single saturated accent.",
  minimal:    "White space, one element, near-monochrome.",
  cinematic:  "Filmic colour grade, anamorphic feel, atmospheric.",
  playful:    "Warm gradients, rounded corners, friendly energy.",
  magazine:   "Editorial cover, big serif display, two-column body, caption rule.",
  noir:       "Late-night gallery, deep ink, gold rule, museum-grade.",
  caribbean:  "Sunlit palette, soft grain, hand-set italic display, intimate framing.",
  letterhead: "Formal correspondence. No imagery in body. Logo lockup top, signature block bottom.",
};

const DEFAULT_THEME_BY_INTENT: Record<Intent, string> = {
  sponsor_deck: "bold",
  pitch_deck: "editorial",
  business_plan: "minimal",
  client_proposal: "editorial",
  treatment: "cinematic",
  rate_card: "minimal",
  moodboard_deck: "cinematic",
  one_pager: "magazine",
  letter_of_intent: "letterhead",
};

// ── Design Styles ────────────────────────────────────────────────────────────
// A "design_style" is the *art-direction lens* the EP applies on top of the
// theme. Maps to a baseline theme + a narrative posture + an image direction.
// Pick to match the audience, not the user's mood.
type DesignStyle =
  | "startup"
  | "luxury"
  | "creative"
  | "editorial"
  | "hospitality"
  | "corporate"
  | "investor";

const DESIGN_STYLES: Record<DesignStyle, { theme: string; voice: string; visual: string; }> = {
  startup: {
    theme: "editorial",
    voice: "Plain-spoken, momentum-forward. Numbers > adjectives. Lead each section with a one-line insight, then proof.",
    visual: "Clean grids. One accent color. Generous white space. Stat cards over body copy. Product UI shots when relevant.",
  },
  luxury: {
    theme: "noir",
    voice: "Quiet authority. Short sentences. Restraint over enthusiasm. Never explain — imply.",
    visual: "Deep neutrals, gold/champagne accent. One image per slide, full-bleed when possible. Serif display, lots of negative space.",
  },
  creative: {
    theme: "bold",
    voice: "First-person, opinionated, with a point of view. Manifesto energy. Slides can be a single sentence.",
    visual: "Oversized type, asymmetric layouts, saturated accent. Pull-quote slides between sections. Moodboard galleries.",
  },
  editorial: {
    theme: "magazine",
    voice: "Long-form, journalistic. Two-column body. Pull quotes mid-section. Reads like a feature piece.",
    visual: "Big serif display, ruled section breaks, caption rules under images, drop caps optional.",
  },
  hospitality: {
    theme: "caribbean",
    voice: "Warm, human, place-aware. Sensory verbs (taste, light, sound). Speak about the guest's experience.",
    visual: "Warm palette, hand-set italic display, full-bleed lifestyle photography, soft grain.",
  },
  corporate: {
    theme: "minimal",
    voice: "Neutral, structured, third-person. Lead with executive summary. Every claim has a number.",
    visual: "Conservative palette, sans-serif, dense info layouts (financial tables, process diagrams), zero decoration.",
  },
  investor: {
    theme: "editorial",
    voice: "Pattern-matching to what VCs scan for: problem → wedge → traction → market → team → ask. No filler.",
    visual: "Stats slides dominate. One hero chart per section. Logo wall on team/credits. Charcoal + one electric accent.",
  },
};

// Heuristic auto-pick when user doesn't specify a design_style.
function inferDesignStyle(intent: Intent, brief: string, audienceHint?: string): DesignStyle {
  const t = `${brief} ${audienceHint || ""}`.toLowerCase();
  if (/vc|venture|seed|series [a-z]|raise|investor|cap table|valuation/.test(t)) return "investor";
  if (/luxury|premium|bespoke|atelier|couture|five.?star|michelin/.test(t)) return "luxury";
  if (/restaurant|hotel|resort|villa|culinary|guest|hospitality|f&b/.test(t)) return "hospitality";
  if (/enterprise|fortune|procurement|rfp|compliance|board/.test(t)) return "corporate";
  if (/magazine|editorial|feature|cover story|publication/.test(t)) return "editorial";
  if (intent === "treatment" || intent === "moodboard_deck") return "creative";
  if (intent === "pitch_deck") return "investor";
  if (intent === "business_plan") return "corporate";
  return "startup";
}

const LAYOUT_GUIDE = `Pick the BEST layout per slide. Don't default to "standard" — that's a failure mode.

CONTENT LAYOUTS
- standard       → fallback. Heading + body + bullets. Avoid when a richer layout fits.
- hero           → opening / section break with full-bleed image. Use image_ref OR image_prompt.
- pull_quote     → single bold sentence to break rhythm between sections. Use quote.text.
- two_column     → comparison / before-after / scope vs out-of-scope. Use columns.

PROOF LAYOUTS
- stats          → 2-3 numeric proof points. Use stats.
- testimonial    → client/co-sign quote with attribution + photo. Use quote{text,attribution,role,avatar_url}.
- team           → people grid with names, roles, optional headshots. Use team[{name,role,note,avatar_url}].
- roll_call      → flat list of past clients / cast / crew. Use roll_call.

NUMBERS & DIAGRAMS
- financial      → revenue / cost / projection table. Use financial{rows:[{label,values:[]}],columns:[],summary?}.
- chart          → ONE chart per slide. Use chart{type:'bar'|'donut'|'line',data:[{label,value,color?}],caption?}.
- timeline       → dated milestones. Use timeline[{date,label,detail?}].
- process        → numbered process steps. Use process[{step,label,detail?}].

VISUAL LAYOUTS
- gallery        → 3-6 image refs from the user's library. Use gallery[{image_ref|image_prompt,caption?}].
- pricing        → packages / sponsor tiers / rate-card. Use pricing.

LETTERHEAD (LOI only)
- letterhead_cover, letterhead_body

HARD RULES
- Sponsor tiers / packages / rate cards → "pricing".
- Team / cast / crew → "team" (with avatars if available) or "roll_call".
- Traction / market size / reach numbers → "stats".
- Revenue, P&L, projections → "financial".
- Any dated sequence (roadmap, milestones, shoot schedule) → "timeline".
- Methodology / how-it-works → "process".
- Client quote, co-sign, endorsement → "testimonial".
- Moodboard / visual references → "gallery" with real image_refs from the user's library when present.
- Break long text sections with a "pull_quote" slide.

IMAGE SOURCING (in priority order)
1. image_ref → URL from the user's Image Library (brand assets, moodboard, project files). PREFER THIS.
2. image_prompt → only when no real asset fits. Must echo the design_style visual direction.
3. Decorative-only slides (stats, financial, process, timeline, pricing) typically need NO image.`;

const SYSTEM = (intent: Intent, theme: string, style: DesignStyle) => `You are Kreto — the user's Executive Producer inside Kretopia. You don't just write — you art-direct.

You're drafting a ${intent.replace(/_/g, " ")} for a creative professional.

DESIGN STYLE: ${style.toUpperCase()}
- Voice: ${DESIGN_STYLES[style].voice}
- Visual direction: ${DESIGN_STYLES[style].visual}

Intent tone: ${INTENT_SKELETONS[intent].tone}
Cover art direction: ${COVER_STYLES[intent]}
Theme overlay (${theme}): ${THEME_HINTS[theme] || THEME_HINTS.editorial}

${LAYOUT_GUIDE}

STORYTELLING
- Open with a hook, not a table of contents.
- Each slide answers ONE question. If a slide answers two, split it.
- Cadence: every 3-4 information slides, insert a "pull_quote", "hero", or "gallery" to breathe.
- End with a single, unambiguous ask. Never "let us know if interested" — give a specific next step + date.

WRITING
- Senior-producer voice. Reference real credits, co-signs, rates, past work where given.
- Punchy, scannable. Short paragraphs. Active verbs.
- Never filler ("As an AI...", "Here is your...", "I have generated..."). Just deliver.
- Match the user's voice if they signal one ("bold, no-fluff").

CONTEXT
- If a BRAND is provided, treat it as law: use the brand name, tagline, voice_tone, palette HEX values, do/dont list, and contact links.
- If STUDIO BRAIN facts/entities are provided, use those real numbers, dates, venues, sponsors, contacts, budgets. Never re-ask.
- STUDIO BRAIN facts were AI-extracted from dropped documents (PDFs, emails, links, contracts), not typed by the user, and some were never manually confirmed -- each fact carries a confidence score. For a fact with confidence below 0.5 (this applies especially to payment terms, deposit/invoice amounts, rates, and contact emails/phones), do not commit it as final: write it as [VERIFY: <value>] the same way you'd handle a missing fact, so the user confirms it before this document is sent. High-confidence facts (names, dates, venues) still don't need this.
- If an IMAGE LIBRARY is provided, prefer image_ref over image_prompt. Match the slide subject to the closest asset.
- If you don't have a fact, leave [PLACEHOLDER: ...] — never invent numbers, dates, or names.

COVER & IMAGERY
- cover_prompt follows the Cover art direction + Theme overlay + Design style visual. Weave brand palette HEX values when present. NO text/logos in the prompt — renderer composes those.
- image_prompt on interior slides echoes the same design language so the deck reads as one object.

QUALITY BAR
- Target: the user sends this immediately, with zero edits. Approach Gamma / Beautiful.ai / Canva Magic Design quality.
- After drafting, self-critique against the rubric (visual_hierarchy, storytelling, brand_alignment, image_use, overall — each 1-10) and fill design_quality. Be honest — if a score is below 8, also list what's weak in design_quality.notes.

Return ONE tool call with the structured document.`;

async function generate(intent: Intent, ctx: Record<string, unknown>, apiKey: string) {
  const skeleton = INTENT_SKELETONS[intent];
  const theme = (ctx.theme as string) || DEFAULT_THEME_BY_INTENT[intent] || "editorial";
  const style = (ctx.design_style as DesignStyle) || inferDesignStyle(intent, String(ctx.user_brief || ""), String((ctx as any).audience || ""));
  (ctx as any).design_style = style;

  const userMsg = `BRIEF FROM USER:
${ctx.user_brief || "(none — infer from context)"}

CONTEXT THRIVE ALREADY KNOWS:
${JSON.stringify(ctx, null, 2)}

SLIDE SKELETON (starting point — add / merge / reorder to fit THIS brief; insert pull_quote/hero/gallery to breathe):
${skeleton.slides.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Draft the document now. Use the richest layout that fits each slide.`;

  const tool = {
    type: "function",
    function: {
      name: "deliver_document",
      description: "Return the finished, send-ready document as structured JSON.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          strategy_summary: { type: "string", description: "1-3 sentences: who this is for, what it needs to do, why this design_style was chosen." },
          design_style: { type: "string", enum: ["startup","luxury","creative","editorial","hospitality","corporate","investor"] },
          cover_prompt: { type: "string", description: "Image-gen prompt for the cover hero image. No text/logos in prompt." },
          cover_image_ref: { type: "string", description: "Optional URL from the Image Library to use as the cover instead of generating." },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                eyebrow: { type: "string" },
                body: { type: "string", description: "Markdown — paragraphs, bullets with -, bold with **." },
                bullets: { type: "array", items: { type: "string" } },
                image_prompt: { type: "string", description: "Optional. Only when no Image Library asset fits." },
                image_ref: { type: "string", description: "Optional URL from the Image Library — PREFER over image_prompt." },
                callout: { type: "string" },
                layout: {
                  type: "string",
                  enum: ["standard","hero","stats","two_column","quote","pull_quote","testimonial","pricing","roll_call","team","timeline","process","financial","chart","gallery","letterhead_cover","letterhead_body"],
                },
                stats: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { value: { type: "string" }, label: { type: "string" }, sub: { type: "string" } },
                    required: ["value","label"], additionalProperties: false,
                  },
                },
                columns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { heading: { type: "string" }, body: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
                    required: ["heading"], additionalProperties: false,
                  },
                },
                quote: {
                  type: "object",
                  description: "Used by quote / pull_quote / testimonial.",
                  properties: { text: { type: "string" }, attribution: { type: "string" }, role: { type: "string" }, avatar_url: { type: "string" } },
                  required: ["text"], additionalProperties: false,
                },
                pricing: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" }, price: { type: "string" },
                      includes: { type: "array", items: { type: "string" } },
                      highlighted: { type: "boolean" },
                    },
                    required: ["name","price","includes"], additionalProperties: false,
                  },
                },
                roll_call: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" }, role: { type: "string" }, note: { type: "string" } },
                    required: ["name","role"], additionalProperties: false,
                  },
                },
                team: {
                  type: "array",
                  description: "Team / cast grid with avatars.",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" }, role: { type: "string" }, note: { type: "string" }, avatar_url: { type: "string" } },
                    required: ["name","role"], additionalProperties: false,
                  },
                },
                timeline: {
                  type: "array",
                  description: "Dated milestones, in order.",
                  items: {
                    type: "object",
                    properties: { date: { type: "string" }, label: { type: "string" }, detail: { type: "string" } },
                    required: ["date","label"], additionalProperties: false,
                  },
                },
                process: {
                  type: "array",
                  description: "Ordered process steps.",
                  items: {
                    type: "object",
                    properties: { step: { type: "string", description: "Step number or short code, e.g. '01'." }, label: { type: "string" }, detail: { type: "string" } },
                    required: ["step","label"], additionalProperties: false,
                  },
                },
                financial: {
                  type: "object",
                  description: "Revenue / cost / projection table.",
                  properties: {
                    columns: { type: "array", items: { type: "string" }, description: "Period headers, e.g. ['Y1','Y2','Y3']." },
                    rows: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { label: { type: "string" }, values: { type: "array", items: { type: "string" } }, emphasis: { type: "boolean" } },
                        required: ["label","values"], additionalProperties: false,
                      },
                    },
                    summary: { type: "string" },
                  },
                  required: ["columns","rows"], additionalProperties: false,
                },
                chart: {
                  type: "object",
                  description: "Single chart for the slide.",
                  properties: {
                    type: { type: "string", enum: ["bar","donut","line"] },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { label: { type: "string" }, value: { type: "number" }, color: { type: "string" } },
                        required: ["label","value"], additionalProperties: false,
                      },
                    },
                    caption: { type: "string" },
                  },
                  required: ["type","data"], additionalProperties: false,
                },
                gallery: {
                  type: "array",
                  description: "3-6 visual references. Prefer image_ref from the library.",
                  items: {
                    type: "object",
                    properties: { image_ref: { type: "string" }, image_prompt: { type: "string" }, caption: { type: "string" } },
                    additionalProperties: false,
                  },
                },
                recipient: {
                  type: "object",
                  properties: {
                    name: { type: "string" }, org: { type: "string" }, address: { type: "string" },
                    date: { type: "string" }, subject: { type: "string" },
                  },
                  additionalProperties: false,
                },
              },
              required: ["heading"], additionalProperties: false,
            },
          },
          next_steps: {
            type: "array",
            description: "3-5 concrete actions the user should take after sending this doc.",
            items: { type: "string" },
          },
          design_quality: {
            type: "object",
            description: "Honest self-scored grade. Below 8 → list weaknesses in notes.",
            properties: {
              visual_hierarchy: { type: "number" },
              storytelling: { type: "number" },
              brand_alignment: { type: "number" },
              image_use: { type: "number" },
              overall: { type: "number" },
              notes: { type: "string" },
            },
            required: ["visual_hierarchy","storytelling","brand_alignment","image_use","overall"],
            additionalProperties: false,
          },
        },
        required: ["title", "slides", "next_steps", "strategy_summary", "design_quality", "design_style"],
        additionalProperties: false,
      },
    },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM(intent, theme, style) },
        { role: "user", content: userMsg },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "deliver_document" } },
    }),
  });

  if (resp.status === 429) throw new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429 });
  if (resp.status === 402) throw new Response(JSON.stringify({ error: "Workspace AI credits exhausted." }), { status: 402 });
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500 });
  }
  const data = await resp.json();
  const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Response(JSON.stringify({ error: "No document returned" }), { status: 500 });
  return JSON.parse(tc.function.arguments);
}

// Pull the image library: brand logo + project moodboard images + uploaded project files (images).
function buildImageLibrary(opts: { brand: any; project: any; files: any[] }) {
  const lib: Array<{ url: string; source: string; caption?: string }> = [];
  if (opts.brand?.logo_url) lib.push({ url: opts.brand.logo_url, source: "brand_logo", caption: opts.brand.name });
  // Moodboard lives on projects.moodboard as jsonb { items:[{url,caption?}] } or similar — be defensive.
  const mb = opts.project?.moodboard;
  const items = Array.isArray(mb) ? mb : (mb?.items || mb?.images || []);
  for (const it of items.slice(0, 12)) {
    const url = typeof it === "string" ? it : (it?.url || it?.image_url);
    if (url) lib.push({ url, source: "moodboard", caption: it?.caption });
  }
  for (const f of (opts.files || []).slice(0, 30)) {
    const url = f.file_url || f.link_thumbnail_url;
    const isImage = (f.file_type || "").startsWith("image/") || f.link_thumbnail_url;
    if (url && isImage) lib.push({ url, source: f.is_link ? "link_thumbnail" : "project_file", caption: f.file_name });
  }
  return lib;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const intent = body.intent as Intent;
    const project_id = body.project_id as string | null;
    const user_brief = (body.user_brief as string) || "";
    const theme = (body.theme as string) || DEFAULT_THEME_BY_INTENT[intent] || "editorial";
    const design_style = body.design_style as DesignStyle | undefined;
    const audience = (body.audience as string) || "";
    const document_id = body.document_id as string | null;

    if (!intent || !INTENT_SKELETONS[intent]) {
      return new Response(JSON.stringify({ error: "Invalid intent" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [profileRes, creditsRes, memoryRes, projectRes, factsRes, entitiesRes, brandRes, filesRes] = await Promise.all([
      admin.from("profiles").select("display_name, username, site_headline, bio, location, professional_role").eq("user_id", user.id).maybeSingle(),
      admin.from("credits").select("project_name, role, year, project_type, thumbnail_url").eq("user_id", user.id).order("year", { ascending: false }).limit(10),
      admin.from("thrive_memory").select("kind, mem_key, label, body, importance").eq("user_id", user.id).order("importance", { ascending: false }).limit(40),
      project_id ? admin.from("projects").select("title, description, workspace_type, deadline, moodboard").eq("id", project_id).maybeSingle() : Promise.resolve({ data: null }),
      project_id ? admin.from("studio_facts").select("kind, label, value, value_numeric, value_date, importance, source_kind, confidence").eq("project_id", project_id).order("importance", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
      project_id ? admin.from("studio_entities").select("kind, name, aliases, attrs, importance").eq("project_id", project_id).order("importance", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
      admin.from("brand_vaults")
        .select("name, logo_url, palette, fonts, voice_tone, tagline, do_dont, links, attrs, is_default, project_id")
        .eq("user_id", user.id)
        .or(project_id ? `project_id.eq.${project_id},and(project_id.is.null,is_default.eq.true)` : `project_id.is.null,is_default.eq.true`)
        .limit(5),
      project_id ? admin.from("project_files").select("file_name, file_url, file_type, is_link, link_provider, link_thumbnail_url").eq("project_id", project_id).limit(40) : Promise.resolve({ data: [] }),
    ]);

    const vaults = brandRes.data || [];
    const brand = vaults.find((v: any) => v.project_id === project_id) || vaults.find((v: any) => v.is_default) || null;

    const image_library = buildImageLibrary({ brand, project: projectRes.data, files: (filesRes as any).data || [] });

    const ctx = {
      user_brief,
      intent,
      audience,
      theme,
      design_style,
      passport: profileRes.data || {},
      recent_credits: creditsRes.data || [],
      memory: memoryRes.data || [],
      studio: projectRes.data || null,
      studio_brain: { facts: factsRes.data || [], entities: entitiesRes.data || [] },
      brand: brand
        ? {
            name: brand.name,
            tagline: brand.tagline,
            voice_tone: brand.voice_tone,
            palette: brand.palette,
            fonts: brand.fonts,
            logo_url: brand.logo_url,
            do: brand.do_dont?.do ?? [],
            dont: brand.do_dont?.dont ?? [],
            links: brand.links,
          }
        : null,
      image_library, // EP picks image_ref URLs from here
    };

    const generated = await generate(intent, ctx, LOVABLE_API_KEY);

    const doc = ctx.brand
      ? { ...generated, brand_snapshot: {
          name: ctx.brand.name,
          tagline: ctx.brand.tagline,
          logo_url: ctx.brand.logo_url,
          palette: ctx.brand.palette,
          fonts: ctx.brand.fonts,
        } }
      : generated;

    let saved;
    if (document_id) {
      const { data: prev } = await admin.from("thrive_documents").select("content").eq("id", document_id).eq("user_id", user.id).maybeSingle();
      if (prev) {
        await admin.from("thrive_document_versions").insert({
          document_id, user_id: user.id, content: prev.content, change_note: "Regenerated",
        });
      }
      const { data, error } = await admin.from("thrive_documents")
        .update({ content: doc, title: doc.title, brief: user_brief, theme, model_used: "google/gemini-2.5-pro" })
        .eq("id", document_id).eq("user_id", user.id).select().single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await admin.from("thrive_documents").insert({
        user_id: user.id,
        project_id,
        intent,
        title: doc.title,
        brief: user_brief,
        content: doc,
        theme,
        status: "draft",
        model_used: "google/gemini-2.5-pro",
        credits_spent: 5,
      }).select().single();
      if (error) throw error;
      saved = data;
    }

    return new Response(JSON.stringify({ document: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) {
      const text = await e.text();
      return new Response(text, { status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("thrive-document-engine error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
