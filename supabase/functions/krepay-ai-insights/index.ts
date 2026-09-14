// krepay-ai-insights
// Summarizes the caller's own KrePay activity in plain language and
// suggests one next action. Read-only: aggregates the user's own
// invoices/expenses/wallet server-side (scoped to auth.uid(), same rows
// MoneyBrief/WeeklyMoneyInsights already compute client-side), sends only
// that aggregate — never raw line items, card data, or other users' data —
// to the LLM. Never initiates, approves, or alters any financial record;
// purely explanatory/suggestive text for the client to render.
//
// Body: {} (no input — always summarizes the caller's own current state)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sentRes, recvRes, expRes, walletRes] = await Promise.all([
      admin.from("invoices")
        .select("id,invoice_number,brand_name,total_amount,amount,currency,status,paid_at,due_date,created_at")
        .eq("issued_by", userId),
      admin.from("invoices")
        .select("total_amount,amount,currency,status,due_date")
        .eq("issued_to", userId),
      admin.from("expenses")
        .select("amount,category,date")
        .eq("user_id", userId)
        .gte("date", monthStart),
      admin.from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const sent = sentRes.data || [];
    const recv = recvRes.data || [];
    const expenses = expRes.data || [];

    const earnedThisMonth = sent
      .filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= new Date(monthStart))
      .reduce((s: number, i: any) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

    const overdueSent = sent.filter(
      (i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && new Date(i.due_date) < now
    );
    const overdueAmount = overdueSent.reduce((s: number, i: any) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

    const owedByYou = recv
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((s: number, i: any) => s + Number(i.total_amount ?? i.amount ?? 0), 0);

    const spentThisMonth = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const walletBalance = Number(walletRes.data?.balance || 0);
    const currency = sent[0]?.currency || "USD";

    // Nothing to say yet — a brand-new account with no activity at all.
    if (sent.length === 0 && recv.length === 0 && expenses.length === 0 && walletBalance === 0) {
      return json({
        summary: "No payment activity yet — once you send an invoice or get paid, this'll summarize how things are going.",
        anomaly: null,
        nextAction: null,
        generatedAt: now.toISOString(),
      });
    }

    const facts = {
      currency,
      walletBalance,
      earnedThisMonth,
      spentThisMonth,
      overdueInvoiceCount: overdueSent.length,
      overdueAmount,
      owedByYou,
    };

    const tools = [{
      type: "function",
      function: {
        name: "emit_insight",
        description: "Emit a short financial activity summary for the user's own dashboard",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "1-2 plain sentences summarizing the period. No emojis, no hype, just the numbers in context." },
            anomaly: { type: "string", description: "One sentence flagging something that needs attention (e.g. overdue invoices), or empty string if nothing stands out." },
            nextAction: { type: "string", description: "One concrete, specific suggested next step the user could take, or empty string if none." },
          },
          required: ["summary", "anomaly", "nextAction"],
        },
      },
    }];

    const userPrompt = `Here is this user's current KrePay activity (all amounts in ${currency}):
- Wallet balance: ${walletBalance}
- Earned this month (paid invoices): ${earnedThisMonth}
- Spent this month (expenses): ${spentThisMonth}
- Overdue invoices: ${overdueSent.length} totaling ${overdueAmount}
- Owed by you (unpaid invoices you received): ${owedByYou}

Write the summary now. Be specific with the numbers given. Never invent a number not listed above.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: "You summarize a creator's own payment activity for their own dashboard. Plain, factual, no emojis, no hype. Never suggest or imply any action will be taken automatically." },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_insight" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limited, try again shortly" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiRes.json();
    const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return json({ error: "No insight generated" }, 500);
    const parsed = JSON.parse(tc.function.arguments || "{}");

    return json({
      summary: parsed.summary || null,
      anomaly: parsed.anomaly || null,
      nextAction: parsed.nextAction || null,
      facts,
      overdueInvoices: overdueSent.slice(0, 5).map((i: any) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        brandName: i.brand_name,
        amount: i.total_amount ?? i.amount,
        currency: i.currency,
        dueDate: i.due_date,
      })),
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    console.error("krepay-ai-insights error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
