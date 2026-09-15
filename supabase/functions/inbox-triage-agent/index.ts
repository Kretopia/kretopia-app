// inbox-triage-agent
// Reads recent inbound message-requests (cold inbounds), classifies each via
// Gemini Flash, and persists to public.inbox_triage_classifications.
// For lead/gig_inquiry/collab it also drafts a reply the owner can approve.
//
// Modes:
//  - Cron (no body):    scan ALL users with unclassified message-requests in the last 24h.
//  - User-triggered:    scan messages for the authenticated user only.
//  - { message_id }:    triage that single message (used by orchestrator tool).
//
// Throttle: skip messages already in inbox_triage_classifications.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const KINDS = ["lead", "gig_inquiry", "collab", "fan", "spam", "admin", "other"] as const;
type Kind = typeof KINDS[number];

interface Classification {
  kind: Kind;
  confidence: number;
  summary: string;
  extracted: {
    budget?: string | null;
    timeline?: string | null;
    scope?: string | null;
    contact_name?: string | null;
    company?: string | null;
  };
  draft_reply?: string | null;
}

const TRIAGE_TOOL = {
  type: "function",
  function: {
    name: "classify_message",
    description: "Classify an inbound creator-economy DM and draft a reply when actionable.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: [...KINDS] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        summary: { type: "string", description: "One-sentence summary of the message intent." },
        extracted: {
          type: "object",
          additionalProperties: false,
          properties: {
            budget: { type: ["string", "null"] },
            timeline: { type: ["string", "null"] },
            scope: { type: ["string", "null"] },
            contact_name: { type: ["string", "null"] },
            company: { type: ["string", "null"] },
          },
        },
        draft_reply: {
          type: ["string", "null"],
          description:
            "A warm, concise reply (2-4 sentences) ONLY for kind=lead|gig_inquiry|collab. Match the recipient's tone. Ask 1-2 clarifying questions if scope is unclear. Otherwise null.",
        },
      },
      required: ["kind", "confidence", "summary", "extracted", "draft_reply"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const cronAuth = req.headers.get("x-cron-secret");
    const isCron = !!CRON_SECRET && cronAuth === CRON_SECRET;

    let scopeUserId: string | null = null;
    let singleMessageId: string | null = null;

    if (!isCron) {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: auth } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "unauthorized" }, 401);
      scopeUserId = u.user.id;

      // Only the user-triggered path is gated here -- the cron path above
      // has no single user to key a per-user limit on, and is already
      // protected by CRON_SECRET.
      const rateLimit = await checkAiFeatureRateLimit(admin, scopeUserId, "inbox-triage-agent");
      if (!rateLimit.allowed) return rateLimit.response;

      if (typeof body?.message_id === "string") singleMessageId = body.message_id;
    }

    // Pull candidate messages
    let q = admin
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, is_message_request")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (singleMessageId) q = q.eq("id", singleMessageId);
    else q = q.eq("is_message_request", true);
    if (scopeUserId) q = q.eq("receiver_id", scopeUserId);

    const { data: msgs, error: mErr } = await q;
    if (mErr) return json({ error: mErr.message }, 500);
    if (!msgs || msgs.length === 0) return json({ ok: true, processed: 0 });

    // Skip already-classified
    const ids = msgs.map((m) => m.id);
    const { data: existing } = await admin
      .from("inbox_triage_classifications")
      .select("message_id")
      .in("message_id", ids);
    const seen = new Set((existing ?? []).map((r) => r.message_id));
    const todo = msgs.filter((m) => !seen.has(m.id));
    if (todo.length === 0) return json({ ok: true, processed: 0, skipped: msgs.length });

    // Lookup sender display names + receiver pro context (for tone)
    const senderIds = [...new Set(todo.map((m) => m.sender_id))];
    const receiverIds = [...new Set(todo.map((m) => m.receiver_id))];
    const { data: senderProfiles } = await admin
      .from("profiles")
      .select("user_id, full_name, role, company, site_headline")
      .in("user_id", senderIds);
    const sMap = new Map((senderProfiles ?? []).map((p) => [p.user_id, p]));
    const { data: rxProfiles } = await admin
      .from("profiles")
      .select("user_id, full_name, role, site_headline")
      .in("user_id", receiverIds);
    const rMap = new Map((rxProfiles ?? []).map((p) => [p.user_id, p]));

    let processed = 0;
    let drafted = 0;
    const errors: string[] = [];

    for (const m of todo.slice(0, 30)) {
      try {
        const sp = sMap.get(m.sender_id);
        const rp = rMap.get(m.receiver_id);
        const cls = await classify(m.content ?? "", sp, rp);
        const { error: insErr } = await admin.from("inbox_triage_classifications").insert({
          message_id: m.id,
          owner_user_id: m.receiver_id,
          sender_user_id: m.sender_id,
          kind: cls.kind,
          confidence: Math.max(0, Math.min(1, cls.confidence ?? 0)),
          summary: cls.summary ?? null,
          extracted: cls.extracted ?? {},
          draft_reply: cls.draft_reply ?? null,
          status: "pending",
        });
        if (insErr) errors.push(`${m.id}: ${insErr.message}`);
        else {
          processed++;
          if (cls.draft_reply) drafted++;
        }
      } catch (e) {
        errors.push(`${m.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return json({ ok: true, processed, drafted, skipped: msgs.length - todo.length, errors });
  } catch (e) {
    console.error("inbox-triage-agent error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

async function classify(
  content: string,
  sender: { full_name?: string | null; role?: string | null; company?: string | null; site_headline?: string | null } | undefined,
  receiver: { full_name?: string | null; role?: string | null; site_headline?: string | null } | undefined,
): Promise<Classification> {
  const sysPrompt = `You are Kreto's Inbox Triage specialist for a creator-economy platform. You read inbound DMs (often from strangers) and classify them so the recipient can act fast.

Recipient: ${receiver?.full_name ?? "unknown"} — ${receiver?.role ?? ""} ${receiver?.site_headline ? `(${receiver.site_headline})` : ""}
Sender: ${sender?.full_name ?? "unknown"} — ${sender?.role ?? ""} ${sender?.company ? `at ${sender.company}` : ""}

Categories:
- lead:        Someone asking the recipient to work for them (paid or unpaid). Brand inquiry, agency outreach.
- gig_inquiry: Specific gig/job/role being offered with at least a hint of scope or timeline.
- collab:      Peer creator wanting to collaborate on something mutual.
- fan:         Compliment, praise, no actionable ask.
- spam:        Crypto, link-bait, mass outreach with no relevance.
- admin:       Platform admin, billing, support, internal.
- other:       Doesn't fit above.

For lead, gig_inquiry, collab: ALWAYS draft a warm, on-brand reply (2-4 sentences). Use the recipient's name in tone — be human, never corporate. Ask 1-2 clarifying questions if scope/budget/timeline is missing. Sign off with first-name only.
For fan/spam/admin/other: draft_reply MUST be null.

Be decisive. confidence = 0.5 means truly uncertain.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Inbound message:\n"""\n${content.slice(0, 2000)}\n"""` },
      ],
      tools: [TRIAGE_TOOL],
      tool_choice: { type: "function", function: { name: "classify_message" } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) throw new Error("no tool_call returned");
  const parsed = JSON.parse(tc.function.arguments) as Classification;
  return parsed;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
