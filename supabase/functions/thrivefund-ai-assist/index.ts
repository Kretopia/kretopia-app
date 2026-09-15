import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";
import { GEMINI_FLASH_IMAGE } from "../_shared/aiModels.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AssistBody {
  action: "tagline" | "story" | "tiers" | "image";
  title?: string;
  category?: string;
  tagline?: string;
  story?: string;
  goal?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Was fully unauthenticated -- no getUser/getClaims anywhere in this
    // file -- an open relay to a paid LLM gateway including image
    // generation (the most expensive call type), reachable by anyone
    // holding the public anon key. The one real caller (FundNew.tsx)
    // already sits behind an authenticated app surface and already sends
    // the user's session JWT via supabase.functions.invoke.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await authedClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const rateLimit = await checkAiFeatureRateLimit(admin, userId, "thrivefund-ai-assist");
    if (!rateLimit.allowed) return rateLimit.response;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const body = (await req.json()) as AssistBody;
    const { action, title = "", category = "", tagline = "", story = "", goal = 0 } = body;

    if (!action) {
      return json({ error: "action required" }, 400);
    }

    if (action === "image") {
      const prompt = `Cinematic, hero campaign cover image for a creative crowdfunding project titled "${title}" in the ${category} category. Mood: aspirational, professional, on-brand for a Kickstarter-style hero banner. No text overlay. 16:9 framing.`;
      const r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GEMINI_FLASH_IMAGE,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!r.ok) return passthroughError(r);
      const data = await r.json();
      const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!url) return json({ error: "No image returned" }, 502);
      return json({ imageDataUrl: url });
    }

    // Text actions
    const systemByAction: Record<string, string> = {
      tagline: "You write punchy, one-line crowdfunding taglines for creative projects. Output ONE line, max 90 characters, no quotes, no emojis, no hashtags.",
      story: "You write compelling, honest crowdfunding campaign stories for creative projects. Markdown allowed (## headings, **bold**, lists). 250-400 words. Cover: what we're making, why it matters, who we are, what backers get, the timeline. No fluff, no clichés, no emojis.",
      tiers: "You design pledge tier ladders for creative crowdfunding campaigns. Return STRICTLY a JSON object via the provided tool — no prose.",
    };

    const userMsg = action === "tagline"
      ? `Title: ${title}\nCategory: ${category}\nStory so far: ${story.slice(0, 600)}\n\nWrite the tagline.`
      : action === "story"
      ? `Title: ${title}\nCategory: ${category}\nTagline: ${tagline}\nFunding goal: $${goal}\n\nWrite the campaign story in markdown.`
      : `Title: ${title}\nCategory: ${category}\nTagline: ${tagline}\nFunding goal: $${goal}\n\nDesign 3-5 pledge tiers, ascending in price and value.`;

    const payload: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemByAction[action] },
        { role: "user", content: userMsg },
      ],
    };

    if (action === "tiers") {
      payload.tools = [{
        type: "function",
        function: {
          name: "suggest_tiers",
          description: "Return pledge tiers for the campaign.",
          parameters: {
            type: "object",
            properties: {
              tiers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    amount: { type: "number" },
                    title: { type: "string" },
                    description: { type: "string" },
                    max_backers: { type: ["number", "null"] },
                  },
                  required: ["amount", "title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tiers"],
            additionalProperties: false,
          },
        },
      }];
      payload.tool_choice = { type: "function", function: { name: "suggest_tiers" } };
    }

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return passthroughError(r);
    const data = await r.json();
    const msg = data?.choices?.[0]?.message;

    if (action === "tiers") {
      const args = msg?.tool_calls?.[0]?.function?.arguments;
      if (!args) return json({ error: "No tiers returned" }, 502);
      try {
        return json(JSON.parse(args));
      } catch {
        return json({ error: "Invalid tier JSON" }, 502);
      }
    }

    return json({ text: (msg?.content || "").trim() });
  } catch (e) {
    console.error("[thrivefund-ai-assist]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function passthroughError(r: Response) {
  if (r.status === 429) return json({ error: "Rate limited. Please try again in a moment." }, 429);
  if (r.status === 402) return json({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }, 402);
  const t = await r.text();
  console.error("AI gateway error", r.status, t);
  return json({ error: "AI gateway error" }, 502);
}
