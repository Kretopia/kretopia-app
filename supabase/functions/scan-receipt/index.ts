import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const allowedCategories = new Set([
  "software", "equipment", "travel", "workspace", "marketing", "education", "subscriptions", "food", "insurance", "taxes", "contractors", "entertainment", "carnival", "events", "other",
]);

const normalizeCategory = (category: unknown) => {
  const raw = typeof category === "string" ? category.toLowerCase().trim() : "other";
  const aliases: Record<string, string> = {
    contractor: "contractors",
    transport: "travel",
    transportation: "travel",
    rent: "workspace",
    utilities: "workspace",
    supplies: "equipment",
  };
  const candidate = aliases[raw] || raw || "other";
  return allowedCategories.has(candidate) ? candidate : "other";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url, image_base64 } = await req.json();
    if (!image_url && !image_base64) {
      return new Response(JSON.stringify({ error: "image_url or image_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imageContent = image_base64
      ? { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : { type: "image_url" as const, image_url: { url: image_url } };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: `You are a receipt/bill data extractor. Return only valid JSON with this shape:
{
  "title": string,
  "vendor": string | null,
  "amount": number | null,
  "currency": string,
  "date": string | null,
  "category": "software" | "equipment" | "travel" | "workspace" | "marketing" | "education" | "subscriptions" | "food" | "insurance" | "taxes" | "contractors" | "entertainment" | "carnival" | "events" | "other",
  "tax_deductible": boolean,
  "line_items": [{ "description": string, "amount": number }],
  "notes": string
}
Extract financial details from receipts, bills, invoices, or screenshots of transactions. Use null when a field is not visible.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all financial details from this receipt/bill image. Find the vendor name, total amount, currency, date, individual items if visible, and suggest an expense category.",
              },
              imageContent,
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("scan-receipt AI error:", response.status, errorText);
      throw new Error(`AI error: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("AI returned no receipt data");
    const parsed = JSON.parse(rawContent);
    parsed.category = normalizeCategory(parsed.category);
    parsed.currency = typeof parsed.currency === "string" && parsed.currency.trim() ? parsed.currency.toUpperCase().slice(0, 3) : "USD";
    parsed.amount = typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : null;
    parsed.title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : (parsed.vendor || "Receipt");
    parsed.line_items = Array.isArray(parsed.line_items) ? parsed.line_items : [];
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ error: "Could not extract data from image" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("scan-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
