// Thrive Creative Tools — Phase 7 agent expansion
// Three drafting tools for the Executive Producer agent:
//   - negotiate_rate    : respond to a lowball / counter an offer
//   - chase_followups   : find stale outreach/quotes/invoices and draft chase messages
//   - recycle_pitch     : adapt a past-winning pitch for a new prospect
//
// All outputs are DRAFT TEXT returned to the orchestrator for user review.
// No autonomous sends. Executive Producer voice: short, declarative, action-first.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `You are Kreto — the user's Executive Producer on Kretopia.
Voice: short, declarative, action-first. No "I'd be happy to". No emojis.
Never fluffy. Sound like a seasoned producer who's seen this 100 times.
Return ONLY the drafted text — no preamble, no sign-off unless asked.`;

async function llm(prompt: string, model = GEMINI_FLASH): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: ures } = await supa.auth.getUser(token);
    const user = ures?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = await checkAiFeatureRateLimit(supa, user.id, "thrive-creative-tools");
    if (!rateLimit.allowed) return rateLimit.response;

    const body = await req.json();
    const tool = body.tool_name || body.action;
    const args = body.tool_args || body.args || body;

    // ─── negotiate_rate ──────────────────────────────────────────────
    if (tool === "negotiate_rate") {
      const { offer_amount, offer_context, your_rate, currency = "USD", tone = "firm-warm" } = args;
      if (!offer_amount || !your_rate) {
        return new Response(JSON.stringify({ error: "offer_amount and your_rate required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const prompt = `Draft a 4-6 sentence reply to an offer.
Offer: ${currency} ${offer_amount}${offer_context ? ` — ${offer_context}` : ""}
Your usual rate: ${currency} ${your_rate}
Tone: ${tone}

Hold the line on value without burning the relationship. Anchor your rate, name one concrete reason it stands (results, turnaround, deliverables), then offer ONE flex — scope down, longer timeline, or trade.
Return only the message body.`;
      const text = await llm(prompt);
      return new Response(
        JSON.stringify({
          ok: true,
          draft: text,
          preview_title: `Counter at ${currency} ${your_rate}`,
          preview_body: text,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── chase_followups ────────────────────────────────────────────
    if (tool === "chase_followups") {
      const daysAgo = Number(args.days || 7);
      const cutoff = new Date(Date.now() - daysAgo * 86400000).toISOString();

      const [outreach, invoices] = await Promise.all([
        supa
          .from("outreach_drafts")
          .select("id, recipient_name, recipient_email, subject, body, status, sent_at, created_at")
          .eq("user_id", user.id)
          .in("status", ["sent"])
          .lt("sent_at", cutoff)
          .order("sent_at", { ascending: false })
          .limit(20)
          .then((r) => r.data || [], () => []),
        supa
          .from("invoices")
          .select("id, client_name, client_email, total_amount, currency, status, sent_at, created_at, due_date")
          .eq("issued_by", user.id)
          .in("status", ["sent", "pending", "overdue"])
          .lt("sent_at", cutoff)
          .order("sent_at", { ascending: false })
          .limit(20)
          .then((r) => r.data || [], () => []),
      ]);

      const items: Array<{ kind: string; ref_id: string; to: string; draft: string; subject?: string }> = [];

      for (const o of outreach) {
        const text = await llm(
          `Draft a short follow-up nudge to ${o.recipient_name || "the recipient"} after no reply in ${daysAgo}+ days.
Original subject: "${o.subject || ""}"
Keep it 3 sentences max. One bump line, one value reminder, one soft close (yes/no/punt).
No "just checking in".`,
        );
        items.push({
          kind: "outreach",
          ref_id: o.id,
          to: o.recipient_email || o.recipient_name || "",
          subject: o.subject ? `Re: ${o.subject}` : "Quick bump",
          draft: text,
        });
      }

      for (const inv of invoices) {
        const text = await llm(
          `Draft a 3-sentence collection nudge to ${inv.client_name || "the client"} for invoice of ${inv.currency || "USD"} ${inv.total_amount}.
Status: ${inv.status}${inv.due_date ? `, due ${inv.due_date}` : ""}.
Polite, direct, no apology. Restate the amount, ask for payment date, offer to resend the link.`,
        );
        items.push({
          kind: "invoice",
          ref_id: inv.id,
          to: inv.client_email || inv.client_name || "",
          subject: `Invoice ${inv.currency} ${inv.total_amount}`,
          draft: text,
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          count: items.length,
          items,
          preview_title: `${items.length} stale thread${items.length === 1 ? "" : "s"} — drafts ready`,
          preview_body: items.length
            ? items.map((i) => `→ ${i.to}: ${i.draft.slice(0, 80)}…`).join("\n")
            : "Nothing stale. You're current.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── recycle_pitch ──────────────────────────────────────────────
    if (tool === "recycle_pitch") {
      const { new_prospect_name, new_prospect_context, project_type } = args;
      if (!new_prospect_name) {
        return new Response(JSON.stringify({ error: "new_prospect_name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pull best-performing past outreach (replied or sent + tied to closed deal)
      const { data: past } = await supa
        .from("outreach_drafts")
        .select("subject, body, recipient_name, status, replied_at")
        .eq("user_id", user.id)
        .in("status", ["replied", "sent"])
        .order("replied_at", { ascending: false, nullsFirst: false })
        .limit(5);

      const samples = (past || []).slice(0, 3).map((p, i) =>
        `Sample ${i + 1} (to ${p.recipient_name || "—"}):
Subject: ${p.subject || ""}
${p.body || ""}`
      ).join("\n\n---\n\n");

      const prompt = samples
        ? `Adapt your best past pitch for a new prospect.

PAST PITCHES THAT WORKED:
${samples}

NEW PROSPECT: ${new_prospect_name}
${new_prospect_context ? `Context: ${new_prospect_context}` : ""}
${project_type ? `For: ${project_type}` : ""}

Keep YOUR voice — phrasing, rhythm, structure. Swap the specifics. 4-6 sentences. End with one concrete ask.
Return subject on first line as "Subject: ...", then blank line, then body.`
        : `Draft a cold-outreach pitch for ${new_prospect_name}.
${new_prospect_context ? `Context: ${new_prospect_context}` : ""}
${project_type ? `For: ${project_type}` : ""}

4-6 sentences. One hook, one credential, one specific ask. No fluff.
Return subject on first line as "Subject: ...", then blank line, then body.`;

      const text = await llm(prompt);
      const [subjectLine, ...rest] = text.split("\n");
      const subject = subjectLine.replace(/^subject:\s*/i, "").trim();
      const draft = rest.join("\n").trim();

      return new Response(
        JSON.stringify({
          ok: true,
          subject,
          draft,
          based_on_samples: (past || []).length,
          preview_title: `Pitch for ${new_prospect_name}`,
          preview_body: `${subject}\n\n${draft}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: `Unknown tool: ${tool}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[thrive-creative-tools]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
