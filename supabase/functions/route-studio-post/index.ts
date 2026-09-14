// Studio Pulse — AI-routes a quick post to the right place in the project.
// Input: { post_id }
// Reads the post + project context, classifies, and creates the routed record.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type Kind =
  | "moodboard"
  | "brief"
  | "note"
  | "task"
  | "approval"
  | "text";

interface Classification {
  kind: Kind;
  title?: string;
  reason?: string;
}

async function classify(
  content: string,
  hasImages: boolean,
  projectTitle: string,
): Promise<Classification> {
  if (!LOVABLE_API_KEY) {
    return { kind: hasImages ? "moodboard" : "note" };
  }

  const sys = `You route quick posts inside a creative project workspace.
Return JSON only: {"kind": one of ["moodboard","brief","note","task","approval","text"], "title": short label, "reason": one sentence}.
Rules:
- "moodboard" = visual references, inspiration images, look/feel.
- "brief" = requirements, scope, deliverables, project specs.
- "note" = decisions, info, meeting recap, generic written context.
- "task" = something that needs doing — actionable, has a verb (e.g. "edit final cut by Friday").
- "approval" = work-in-progress shared for sign-off (e.g. "v2 ready for approval", "please review").
- "text" = chitchat or unclear — leave as a feed post.
If images attached and no clear text intent → moodboard.`;

  const user = `Project: "${projectTitle}"
Has images: ${hasImages}
Post: """${content || "(no text)"}"""`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GEMINI_FLASH,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`gateway ${r.status}`);
    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(txt);
    const kind: Kind = ["moodboard", "brief", "note", "task", "approval", "text"]
      .includes(parsed.kind)
      ? parsed.kind
      : hasImages
        ? "moodboard"
        : "note";
    return { kind, title: parsed.title, reason: parsed.reason };
  } catch (e) {
    console.warn("[route-studio-post] classify fallback:", (e as Error).message);
    return { kind: hasImages ? "moodboard" : "note" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Previously used the service-role key to read/write any project's posts
    // by id with no check that the caller belonged to that project (IDOR).
    // Require a real caller and confirm they authored the post before
    // routing it — matches how this is actually invoked (right after the
    // caller creates their own post).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: post, error: postErr } = await admin
      .from("studio_pulse_posts")
      .select("*")
      .eq("id", post_id)
      .maybeSingle();
    if (postErr || !post) throw new Error(postErr?.message ?? "post not found");
    if (post.author_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized for this post" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, title, brief_summary")
      .eq("id", post.project_id)
      .maybeSingle();

    const hasImages = (post.image_urls ?? []).length > 0;
    const classification = await classify(
      post.content ?? "",
      hasImages,
      project?.title ?? "Untitled",
    );

    let routed_to: string | null = null;
    let routed_id: string | null = null;
    let approval_status: string | null = null;
    const meta: Record<string, unknown> = {
      reason: classification.reason,
      title: classification.title,
    };

    const fallbackTitle =
      classification.title ||
      (post.content?.slice(0, 80) ?? "Untitled");

    switch (classification.kind) {
      case "task": {
        const { data: t } = await admin
          .from("project_tasks")
          .insert({
            project_id: post.project_id,
            title: fallbackTitle,
            description: post.content ?? null,
            status: "todo",
            created_by: post.author_id,
          })
          .select("id")
          .single();
        if (t) {
          routed_to = "project_tasks";
          routed_id = t.id;
        }
        break;
      }
      case "note":
      case "brief": {
        const { data: n } = await admin
          .from("project_notes")
          .insert({
            project_id: post.project_id,
            title:
              classification.kind === "brief"
                ? `Brief: ${fallbackTitle}`
                : fallbackTitle,
            content: post.content ?? "",
            created_by: post.author_id,
          })
          .select("id")
          .single();
        if (n) {
          routed_to = "project_notes";
          routed_id = n.id;
        }
        break;
      }
      case "moodboard": {
        // Save images as project_files (which the BriefSection treats as references)
        if (hasImages) {
          const rows = (post.image_urls as string[]).map((url) => ({
            project_id: post.project_id,
            user_id: post.author_id,
            file_name: url.split("/").pop() ?? "reference",
            file_url: url,
            file_type: "image",
          }));
          const { data: inserted } = await admin
            .from("project_files")
            .insert(rows)
            .select("id");
          routed_to = "project_files";
          routed_id = inserted?.[0]?.id ?? null;
        }
        break;
      }
      case "approval": {
        approval_status = "pending";
        // Approvals stay on the post itself; collaborators tap Approve/Request changes.
        break;
      }
      case "text":
      default:
        // No routing — lives in the feed only.
        break;
    }

    const { error: updErr } = await admin
      .from("studio_pulse_posts")
      .update({
        kind: classification.kind,
        routed_to,
        routed_id,
        approval_status,
        metadata: meta,
      })
      .eq("id", post_id);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        kind: classification.kind,
        routed_to,
        routed_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[route-studio-post]", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
