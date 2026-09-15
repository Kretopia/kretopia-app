import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 6000) : "";
    if (!text) return json({ error: "Paste an email signature, brief, or a few details first." }, 400);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You extract CLIENT contact records from pasted text (email signatures, briefs, DMs, invoices).
Return ONLY a JSON object with these fields:
- name: string (the human contact name; if only a company is present, reuse the company name)
- company_name: string or null
- contact_email: string or null
- contact_phone: string or null
- website: string or null (full URL)
- payment_terms: string or null (e.g. "Net 30", "50% upfront")
- default_markup_pct: number or null
- notes: string or null (one or two short lines of useful context — what they need, budget, timeline)
Never invent an email, phone or price. Use null when there is no signal.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      console.error("AI error", aiResp.status, await aiResp.text());
      return json({ error: `AI extraction failed (${aiResp.status})` }, 500);
    }

    const raw = (await aiResp.json())?.choices?.[0]?.message?.content;
    if (!raw) return json({ error: "AI returned no content" }, 500);

    let extracted: any;
    try {
      extracted = JSON.parse(raw);
    } catch {
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (!m) return json({ error: "Could not parse AI response" }, 500);
      extracted = JSON.parse(m[1].trim());
    }

    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const markup = Number(extracted?.default_markup_pct);

    return json({
      success: true,
      extracted: {
        name: str(extracted?.name) ?? str(extracted?.company_name) ?? "",
        company_name: str(extracted?.company_name),
        contact_email: str(extracted?.contact_email),
        contact_phone: str(extracted?.contact_phone),
        website: str(extracted?.website),
        payment_terms: str(extracted?.payment_terms),
        default_markup_pct: Number.isFinite(markup) ? Math.max(0, Math.min(100, markup)) : 0,
        notes: str(extracted?.notes),
      },
    });
  } catch (e) {
    console.error("extract-client-details error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
