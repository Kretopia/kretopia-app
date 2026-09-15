import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    const userId = userData.user.id;

    const rateLimit = await checkAiFeatureRateLimit(supabase, userId, "ai-finance");
    if (!rateLimit.allowed) return rateLimit.response;

    const { action, expenses, invoices, expense } = await req.json();

    if (action === "categorize") {
      // Auto-categorize a single expense from title/vendor
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an expense categorizer for creative professionals. Given an expense title and optional vendor, return the best category from this list: software, equipment, travel, workspace, marketing, education, subscriptions, food, insurance, taxes, contractors, entertainment, other. Also determine if it's likely tax deductible for a freelancer/solopreneur. Return JSON only: {"category": "string", "tax_deductible": boolean, "subcategory": "optional string"}`
            },
            {
              role: "user",
              content: `Title: "${expense.title}"${expense.vendor ? `, Vendor: "${expense.vendor}"` : ""}`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "categorize_expense",
              description: "Categorize an expense",
              parameters: {
                type: "object",
                properties: {
                  category: { type: "string", enum: ["software", "equipment", "travel", "workspace", "marketing", "education", "subscriptions", "food", "insurance", "taxes", "contractors", "entertainment", "other"] },
                  tax_deductible: { type: "boolean" },
                  subcategory: { type: "string" }
                },
                required: ["category", "tax_deductible"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "categorize_expense" } }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI categorize error:", response.status, errText);
        throw new Error("AI categorization failed");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("No categorization result");
    }

    if (action === "insights") {
      // Generate financial insights from expense + invoice data
      const totalIncome = (invoices || []).filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total_amount || i.amount || 0), 0);
      const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const categoryBreakdown: Record<string, number> = {};
      (expenses || []).forEach((e: any) => {
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount);
      });
      const recurringTotal = (expenses || []).filter((e: any) => e.is_recurring).reduce((s: number, e: any) => s + Number(e.amount), 0);
      const taxDeductibleTotal = (expenses || []).filter((e: any) => e.tax_deductible).reduce((s: number, e: any) => s + Number(e.amount), 0);

      const summary = `
Income: $${totalIncome.toFixed(2)}
Expenses: $${totalExpenses.toFixed(2)}
Net: $${(totalIncome - totalExpenses).toFixed(2)}
Recurring monthly: $${recurringTotal.toFixed(2)}
Tax deductible: $${taxDeductibleTotal.toFixed(2)}
Category breakdown: ${JSON.stringify(categoryBreakdown)}
Number of invoices: ${(invoices || []).length}
Number of expenses: ${(expenses || []).length}
`.trim();

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a financial advisor for creative freelancers and solopreneurs. Analyze their financial data and provide 4-6 actionable insights. Focus on:
1. Spending patterns and optimization opportunities
2. Tax deduction opportunities they might be missing
3. Cash flow health and recommendations
4. Recurring expense optimization
5. Income diversification suggestions
6. Budget recommendations based on the 50/30/20 rule adapted for creatives

Be specific, practical, and encouraging. Use emoji for visual appeal. Each insight should be 1-2 sentences max. Format as a JSON array of objects with "title" (short heading), "insight" (the advice), "type" (one of: saving, tax, cashflow, growth, warning, tip), and "priority" (high, medium, low).`
            },
            { role: "user", content: `Here's my financial summary for analysis:\n${summary}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "provide_insights",
              description: "Provide financial insights",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        insight: { type: "string" },
                        type: { type: "string", enum: ["saving", "tax", "cashflow", "growth", "warning", "tip"] },
                        priority: { type: "string", enum: ["high", "medium", "low"] }
                      },
                      required: ["title", "insight", "type", "priority"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["insights"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "provide_insights" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await response.text();
        console.error("AI insights error:", response.status, errText);
        throw new Error("AI insights generation failed");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("No insights generated");
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-finance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
