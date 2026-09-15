import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { GEMINI_FLASH, GEMINI_FLASH_IMAGE } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { opportunity_id, mode } = await req.json();
    // mode: "enhance_text" | "generate_image" | "both"

    if (!opportunity_id) {
      return new Response(JSON.stringify({ error: "opportunity_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: opp, error: fetchErr } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunity_id)
      .single();

    if (fetchErr || !opp) {
      return new Response(JSON.stringify({ error: "Opportunity not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, any> = {};

    // Enhance text
    if (mode === "enhance_text" || mode === "both") {
      const prompt = `You are a professional copywriter for creative gig listings. Take these raw details and rewrite them into a polished, compelling listing.

Current details:
- Title: ${opp.title}
- Type: ${opp.type}
- Description: ${opp.description || "None"}
- Compensation: ${opp.compensation || "None"}
- Location: ${opp.location || "None"}
- Requirements: ${opp.requirements || "None"}
- Skills: ${opp.skills?.join(", ") || "None"}
- Deliverables: ${opp.deliverables || "None"}
- Duration: ${opp.duration || "None"}

Rewrite to be professional, compelling, well-structured. Keep factual details accurate but improve clarity and appeal.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_FLASH,
          messages: [{ role: "user", content: prompt }],
          tools: [{
            type: "function",
            function: {
              name: "enhance_gig",
              description: "Return enhanced gig listing copy",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  requirements: { type: ["string", "null"] },
                  deliverables: { type: ["string", "null"] },
                  skills: { type: "array", items: { type: "string" } },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["title", "description", "skills", "tags"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "enhance_gig" } },
        }),
      });

      if (!aiRes.ok) {
        const status = aiRes.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again shortly" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI enhancement failed: ${status}`);
      }

      const aiData = await aiRes.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const enhanced = JSON.parse(toolCall.function.arguments);
        updates.title = enhanced.title;
        updates.description = enhanced.description;
        if (enhanced.requirements) updates.requirements = enhanced.requirements;
        if (enhanced.deliverables) updates.deliverables = enhanced.deliverables;
        if (enhanced.skills?.length) updates.skills = enhanced.skills;
        if (enhanced.tags?.length) updates.tags = enhanced.tags;
      }
    }

    // Generate cover image
    if (mode === "generate_image" || mode === "both") {
      const imagePrompt = `Create a professional, visually striking cover image for this creative gig: "${opp.title}". ${opp.description ? `Context: ${opp.description.slice(0, 200)}` : ""}. Clean, modern banner style. No text or words. Aspect ratio 16:9.`;

      try {
        const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GEMINI_FLASH_IMAGE,
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        });

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          const base64Image = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (base64Image) {
            const raw = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
            const imageBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
            const fileName = `gig-covers/${crypto.randomUUID()}.png`;

            const { error: uploadErr } = await supabase.storage
              .from("opportunities")
              .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });

            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from("opportunities").getPublicUrl(fileName);
              if (urlData?.publicUrl) updates.image_url = urlData.publicUrl;
            } else {
              console.error("Upload error:", uploadErr);
            }
          }
        } else {
          console.error("Image gen failed:", imgRes.status);
        }
      } catch (imgErr) {
        console.error("Image gen error:", imgErr);
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from("opportunities")
        .update(updates)
        .eq("id", opportunity_id);

      if (updateErr) throw new Error("Failed to update opportunity");
    }

    return new Response(JSON.stringify({ success: true, updates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enhance-gig error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
