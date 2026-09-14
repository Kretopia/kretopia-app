// send-invoice-chase
// Drafts (and optionally sends) a polite payment-chase email for an overdue invoice.
// Owner approval gate: if `send=true` AND user has Gmail configured, sends via SMTP.
// Otherwise inserts an outreach_drafts row with status='draft'.
//
// Body: { invoice_id: string, tone?: 'friendly'|'firm', send?: boolean }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const token = auth.replace("Bearer ", "");
    const { data: claimsData, error: cErr } = await (userClient.auth as any).getClaims(token);
    if (cErr || !claimsData?.claims) return json({ error: "unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoice_id as string;
    const tone = (body.tone === "firm" ? "firm" : "friendly") as "friendly" | "firm";
    const send = !!body.send;
    if (!invoiceId) return json({ error: "invoice_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: invoice } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("issued_by", userId)
      .maybeSingle();
    if (!invoice) return json({ error: "invoice not found" }, 404);

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, site_headline")
      .eq("user_id", userId)
      .maybeSingle();

    const daysOverdue = invoice.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000))
      : 0;

    const tools = [{
      type: "function",
      function: {
        name: "emit_chase_email",
        description: "Emit a polite invoice chase email",
        parameters: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string", description: "3-5 short sentences. No emojis. Reference invoice number, amount, days overdue. End with simple ask." },
          },
          required: ["subject", "body"],
        },
      },
    }];

    const sysPrompt = tone === "firm"
      ? "You write professional, direct payment-chase emails. Polite but firm. No fluff. No emojis."
      : "You write warm, professional payment-chase emails. Friendly tone, never aggressive. No emojis.";

    const userPrompt = `Invoice ${invoice.invoice_number} for ${invoice.brand_name || invoice.issued_to || "client"}.
Amount: ${invoice.currency} ${invoice.amount}
Due: ${invoice.due_date} (${daysOverdue} days overdue)
From: ${profile?.display_name || "the creator"}
${invoice.payment_link_url ? `Payment link: ${invoice.payment_link_url}` : ""}

Draft the chase email now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userPrompt }],
        tools,
        tool_choice: { type: "function", function: { name: "emit_chase_email" } },
      }),
    });
    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limited" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI gateway error" }, 500);
    }
    const aiData = await aiRes.json();
    const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "No draft" }, 500);
    const parsed = JSON.parse(tc.function.arguments || "{}");
    if (!parsed.subject || !parsed.body) return json({ error: "Incomplete draft" }, 500);

    // Save as draft
    const recipientEmail = invoice.brand_email || null;
    const { data: draft, error: insErr } = await admin
      .from("outreach_drafts")
      .insert({
        user_id: userId,
        source: "chase_invoice",
        recipient_name: invoice.brand_name,
        recipient_email: recipientEmail,
        brand_name: invoice.brand_name,
        subject: parsed.subject.slice(0, 200),
        body: parsed.body.slice(0, 4000),
        status: send && recipientEmail ? "approved" : "draft",
        meta: { invoice_id: invoiceId, tone, days_overdue: daysOverdue },
      })
      .select()
      .single();
    if (insErr) return json({ error: insErr.message }, 500);

    if (send && recipientEmail) {
      // Hand off to send-outreach-draft
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-outreach-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ draft_id: draft.id }),
      });
      if (sendRes.ok) {
        await admin
          .from("invoices")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", invoiceId);
      }
    }

    return json({ ok: true, draft });
  } catch (e) {
    console.error("send-invoice-chase error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
