import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) throw new Error("User not authenticated");

    const { ticketId, message, conversationHistory } = await req.json();
    
    console.log("Processing support request for ticket:", ticketId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are an AI support assistant for a creator platform (similar to LinkedIn + Behance + Fiverr for creators).

Your job is to:
1. Understand user issues and categorize them (bug, feature-request, question, feedback)
2. Provide instant troubleshooting steps when possible
3. Guide users to relevant features or documentation
4. Be empathetic and helpful
5. If you can't solve the issue, acknowledge it and let the user know their issue will be escalated to the team

Key platform features:
- Discover: Swipe interface to find creators and opportunities
- Profile: Portfolio, reviews, achievements, social links
- Circle: Connections and collaborations
- ThriveDesk: Project management workspace
- Spark: Social feed for creators
- Credits system and subscriptions

Respond concisely and helpfully. If it's a bug, try to understand the exact steps to reproduce it.`
      },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Service temporarily unavailable. Your message has been saved and our team will respond soon." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices[0].message.content;

    // Auto-categorize the issue based on AI analysis
    const category = await categorizeIssue(messages, LOVABLE_API_KEY);

    // Save AI response to database
    await supabaseClient.from('support_messages').insert({
      ticket_id: ticketId,
      sender_type: 'ai',
      content: aiMessage,
      metadata: { category, model: GEMINI_FLASH }
    });

    // Update ticket category if not already set
    if (category) {
      await supabaseClient
        .from('support_tickets')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .is('category', null);
    }

    return new Response(JSON.stringify({ 
      message: aiMessage,
      category 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in ai-support function:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function categorizeIssue(messages: any[], apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          {
            role: "system",
            content: "Categorize this support request into ONE category: bug, feature-request, question, or feedback. Respond with ONLY the category name, nothing else."
          },
          ...messages
        ],
        temperature: 0.3,
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const category = data.choices[0].message.content.trim().toLowerCase();
      return ['bug', 'feature-request', 'question', 'feedback'].includes(category) ? category : null;
    }
  } catch (error) {
    console.error("Error categorizing issue:", error);
  }
  return null;
}