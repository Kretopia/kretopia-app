// money-agent-watch — daily cron 09:00 UTC.
// 1. Find overdue invoices (>3 days past due_date, status pending/sent, not chased in last 5 days)
//    -> draft chase email (calls send-invoice-chase with send=false) -> creates outreach_drafts + agent_proposal kind='chase_invoice'
// 2. Find deliverables flipped to 'approved' in last 24h with no invoice for that milestone
//    -> creates agent_proposal kind='draft_invoice' so user one-taps to draft
//
// Auth: x-cron-secret header.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron, adminGuardCorsHeaders } from "../_shared/admin-guard.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = adminGuardCorsHeaders;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const guard = await requireAdminOrCron(req);
    if (!guard.ok) return guard.response;


    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const dueCutoff = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const chaseCooldown = new Date(now.getTime() - 5 * 86400000).toISOString();

    // === 1. Overdue invoices ===
    const { data: overdue } = await admin
      .from("invoices")
      .select("id, invoice_number, issued_by, brand_name, brand_email, amount, currency, due_date, reminder_sent_at, project_id, status")
      .in("status", ["pending", "sent", "overdue"])
      .not("due_date", "is", null)
      .lte("due_date", dueCutoff)
      .is("paid_at", null)
      .limit(200);

    let chaseProposals = 0;
    let chaseDrafts = 0;

    for (const inv of overdue || []) {
      if (inv.reminder_sent_at && inv.reminder_sent_at > chaseCooldown) continue;

      // Skip if proposal/draft already pending for this invoice
      const { count: existing } = await admin
        .from("agent_proposals")
        .select("*", { count: "exact", head: true })
        .eq("owner_user_id", inv.issued_by)
        .eq("kind", "chase_invoice")
        .eq("status", "pending")
        .filter("source_signal->>invoice_id", "eq", inv.id);
      if ((existing ?? 0) > 0) continue;

      // Draft the chase via Lovable AI directly (no auth needed - we're system)
      let subject = `Friendly nudge — Invoice ${inv.invoice_number}`;
      let body =
        `Hi ${inv.brand_name || "there"},\n\nJust circling back on invoice ${inv.invoice_number} for ${inv.currency} ${inv.amount}, which was due ${inv.due_date}. Could you confirm when payment will go out?\n\nThanks!`;

      if (LOVABLE_API_KEY) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: GEMINI_FLASH,
              messages: [
                { role: "system", content: "You write warm, professional invoice chase emails. 3-4 short sentences, no emojis." },
                { role: "user", content: `Invoice ${inv.invoice_number}, ${inv.currency} ${inv.amount}, due ${inv.due_date} (overdue). Brand: ${inv.brand_name || "client"}. Draft subject + body. Output JSON: {"subject":"...","body":"..."}` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (aiRes.ok) {
            const d = await aiRes.json();
            const parsed = JSON.parse(d?.choices?.[0]?.message?.content || "{}");
            if (parsed.subject) subject = parsed.subject;
            if (parsed.body) body = parsed.body;
          }
        } catch (e) { console.error("ai chase err", e); }
      }

      // Insert outreach_draft
      const { data: draft } = await admin
        .from("outreach_drafts")
        .insert({
          user_id: inv.issued_by,
          source: "chase_invoice",
          recipient_name: inv.brand_name,
          recipient_email: inv.brand_email,
          brand_name: inv.brand_name,
          subject: subject.slice(0, 200),
          body: body.slice(0, 4000),
          status: "draft",
          meta: { invoice_id: inv.id, days_overdue: Math.floor((now.getTime() - new Date(inv.due_date!).getTime()) / 86400000) },
        })
        .select("id")
        .single();
      if (draft) chaseDrafts++;

      // Insert agent_proposal so it surfaces in StudioRoom too (if project_id present)
      if (inv.project_id) {
        await admin.from("agent_proposals").insert({
          owner_user_id: inv.issued_by,
          project_id: inv.project_id,
          kind: "chase_invoice",
          title: `Chase ${inv.brand_name || "client"} — invoice ${inv.invoice_number}`,
          body: `${inv.currency} ${inv.amount} overdue since ${inv.due_date}. Kreto drafted a polite reminder.`,
          status: "pending",
          source_signal: { invoice_id: inv.id, draft_id: draft?.id },
          action_intent: { tool: "send_chase_email", args: { invoice_id: inv.id } },
          expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
        });
        chaseProposals++;
      }

      // Notify
      await admin.from("notifications").insert({
        user_id: inv.issued_by,
        type: "invoice_chase_drafted",
        category: "agent",
        title: `Kreto drafted a chase for ${inv.brand_name || "client"}`,
        message: `Invoice ${inv.invoice_number} (${inv.currency} ${inv.amount}) is ${Math.floor((now.getTime() - new Date(inv.due_date!).getTime()) / 86400000)} days overdue.`,
        action_url: "/intel?tab=outbox",
        action_text: "Review",
      }).catch(() => {});
    }

    // === 2. Approved deliverables without invoice ===
    const since = new Date(now.getTime() - 24 * 3600000).toISOString();
    const { data: deliverables } = await admin
      .from("project_deliverables")
      .select("id, project_id, title, milestone_id, reviewed_at, kind")
      .eq("status", "approved")
      .gte("reviewed_at", since)
      .limit(200);

    let milestoneProposals = 0;
    for (const d of deliverables || []) {
      // Skip if we've already proposed for this deliverable
      const { count: existing } = await admin
        .from("agent_proposals")
        .select("*", { count: "exact", head: true })
        .eq("kind", "draft_invoice")
        .eq("project_id", d.project_id)
        .filter("source_signal->>deliverable_id", "eq", d.id);
      if ((existing ?? 0) > 0) continue;

      // Skip if invoice already exists for this milestone
      if (d.milestone_id) {
        const { count: invExists } = await admin
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("milestone_id", d.milestone_id);
        if ((invExists ?? 0) > 0) continue;
      }

      const { data: project } = await admin
        .from("projects")
        .select("owner_id, name, client_name")
        .eq("id", d.project_id)
        .maybeSingle();
      if (!project?.owner_id) continue;

      await admin.from("agent_proposals").insert({
        owner_user_id: project.owner_id,
        project_id: d.project_id,
        kind: "draft_invoice",
        title: `Invoice ${project.client_name || "client"} for "${d.title}"?`,
        body: `Deliverable just approved. Want Thrive to draft the milestone invoice?`,
        status: "pending",
        source_signal: { deliverable_id: d.id, milestone_id: d.milestone_id },
        action_intent: { tool: "draft_milestone_invoice", args: { project_id: d.project_id, deliverable_id: d.id } },
        expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
      });
      milestoneProposals++;
    }

    return json({ ok: true, chase_drafts: chaseDrafts, chase_proposals: chaseProposals, milestone_proposals: milestoneProposals });
  } catch (e) {
    console.error("money-agent-watch error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
