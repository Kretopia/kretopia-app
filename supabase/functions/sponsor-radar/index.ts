// Sponsor Radar — web-sourced sponsor/brand opportunities matched to creator + project/event.
// On-demand: { niche?: string, project_id?: string, project_title?: string, count?: number }
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkAiFeatureRateLimit } from "../_shared/aiRateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FIRECRAWL_SEARCH = "https://api.firecrawl.dev/v2/search";

const clean = (v: unknown) => String(v ?? "").trim();
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function firecrawlSearch(query: string) {
  if (!FIRECRAWL_API_KEY) throw new Error("Web search is not configured");
  const res = await fetch(FIRECRAWL_SEARCH, {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: 8,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) {
    console.warn("[sponsor-radar] Firecrawl failed", query, res.status, await res.text().catch(() => ""));
    return [];
  }
  const json = await res.json();
  const arr = Array.isArray(json.data) ? json.data : Array.isArray(json.data?.web) ? json.data.web : Array.isArray(json.web) ? json.web : [];
  return arr.map((item: any) => ({
    url: item.url,
    title: item.title || item.metadata?.title || "",
    description: item.description || item.metadata?.description || "",
    markdown: String(item.markdown || "").slice(0, 1800),
  })).filter((item: any) => item.url);
}

async function getUserProjects(supabase: any, userId: string) {
  const { data: owned } = await supabase
    .from("projects")
    .select("id, title, description, workspace_type, created_by")
    .eq("created_by", userId)
    .neq("status", "archived")
    .limit(50);

  const { data: collabRows } = await supabase
    .from("project_collaborators")
    .select("project_id")
    .eq("user_id", userId)
    .eq("status", "accepted");

  let collabProjects: any[] = [];
  const ids = (collabRows || []).map((r: any) => r.project_id).filter(Boolean);
  if (ids.length) {
    const { data } = await supabase
      .from("projects")
      .select("id, title, description, workspace_type, created_by")
      .in("id", ids)
      .neq("status", "archived")
      .limit(50);
    collabProjects = data || [];
  }

  const seen = new Set<string>();
  return [...(owned || []), ...collabProjects].filter((p: any) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function bestProjectMatch(projects: any[], phrase: string) {
  const target = norm(phrase);
  if (!target) return null;
  const words = target.split(" ").filter((w) => w.length > 2);
  let best: any = null;
  let bestScore = 0;
  for (const p of projects) {
    const title = norm(p.title || "");
    let score = title === target ? 100 : title.includes(target) || target.includes(title) ? 80 : 0;
    score += words.filter((w) => title.includes(w)).length * 12;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 35 ? best : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");
    if (!FIRECRAWL_API_KEY) throw new Error("Web search is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const rateLimit = await checkAiFeatureRateLimit(supabase, userId, "sponsor-radar");
    if (!rateLimit.allowed) return rateLimit.response;

    const body = await req.json().catch(() => ({}));
    const count = Math.min(8, Math.max(3, Number(body.count) || 5));

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name, primary_role, role, sub_roles, skills, location, country, bio")
      .eq("user_id", userId)
      .maybeSingle();

    const projects = await getUserProjects(supabase, userId);
    let project = body.project_id ? projects.find((p: any) => p.id === body.project_id) : null;
    const requestedNiche = clean(body.niche || body.project_title);
    if (!project && requestedNiche) project = bestProjectMatch(projects, requestedNiche);

    const projectTitle = clean(body.project_title || project?.title);
    const niche = requestedNiche || projectTitle || clean(profile?.primary_role || profile?.role) || "creative";
    const region = clean(profile?.location || profile?.country) || "global";
    const projectBrief = clean(project?.description).slice(0, 600);

    const queries = [
      `"${niche}" sponsors partners brands contact email`,
      `"${niche}" sponsorship brand partnership email`,
      `${niche} ${region} brands sponsors partnerships email`,
      `${niche} event sponsors brand partners contact`,
      `Caribbean carnival brand sponsors partnerships contact email ${region}`,
    ];

    const raw: any[] = [];
    for (const batch of [queries.slice(0, 3), queries.slice(3)]) {
      const results = await Promise.all(batch.map(firecrawlSearch));
      results.flat().forEach((r) => raw.push(r));
    }
    const deduped = Array.from(new Map(raw.map((r) => [String(r.url).split("?")[0], r])).values()).slice(0, 30);

    const snippets = deduped.map((r: any, i) => `[${i + 1}] URL: ${r.url}\nTITLE: ${r.title}\nDESCRIPTION: ${r.description}\nCONTENT: ${r.markdown}`).join("\n\n---\n\n");

    const ai = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          {
            role: "system",
            content: "You are a sponsorship research agent. Extract REAL sponsor leads only from the supplied web results. Do not invent brands, emails, phone numbers, addresses, or URLs. Prefer brands with visible sponsorship, partnership, events, tourism, beverage, fashion, lifestyle, music, culture, or creator marketing relevance. If a direct email is not present, use the best public partnerships/contact page URL and put uncertainty in contact_hint.",
          },
          {
            role: "user",
            content: `CREATOR\nName: ${profile?.display_name || profile?.full_name || "Creator"}\nRole: ${profile?.primary_role || profile?.role || "creative"}\nSkills: ${(profile?.skills || []).slice(0, 12).join(", ")}\nRegion: ${region}\nBio: ${clean(profile?.bio).slice(0, 400)}\n\nTARGET\nNiche/Event/Project: ${niche}\nProject title: ${projectTitle || "—"}\nProject brief: ${projectBrief || "—"}\n\nWEB RESULTS\n${snippets}\n\nReturn up to ${count} sponsor leads. For each, include exact source_url and evidence from the result. Include email/phone/address only when found in the web text.`, 
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_sponsor_leads",
            description: "Emit verified sponsor leads from web search results",
            parameters: {
              type: "object",
              properties: {
                leads: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      brand_name: { type: "string" },
                      brand_url: { type: "string" },
                      website: { type: "string" },
                      contact_name: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      address: { type: "string" },
                      niche: { type: "string" },
                      fit_score: { type: "integer", minimum: 0, maximum: 100 },
                      reason: { type: "string" },
                      evidence: { type: "string" },
                      pitch_draft: { type: "string" },
                      contact_hint: { type: "string" },
                      source_url: { type: "string" },
                    },
                    required: ["brand_name", "fit_score", "reason", "pitch_draft", "source_url"],
                  },
                },
              },
              required: ["leads"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_sponsor_leads" } },
      }),
    });

    if (!ai.ok) {
      console.error("[sponsor-radar] AI", ai.status, await ai.text());
      return new Response(JSON.stringify({ error: "ai_failed", status: ai.status }), { status: 502, headers: corsHeaders });
    }

    const j = await ai.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { leads: [] };
    const leads = Array.isArray(parsed.leads) ? parsed.leads.slice(0, count) : [];

    const rows = leads.map((l: any) => ({
      user_id: userId,
      project_id: project?.id || null,
      brand_name: clean(l.brand_name),
      brand_url: clean(l.brand_url || l.website) || null,
      website: clean(l.website || l.brand_url) || null,
      contact_name: clean(l.contact_name) || null,
      contact_email: clean(l.email) || null,
      contact_phone: clean(l.phone) || null,
      address: clean(l.address) || null,
      niche: clean(l.niche || niche),
      fit_score: Math.max(0, Math.min(100, Number(l.fit_score) || 50)),
      reason: clean(l.reason),
      pitch_draft: clean(l.pitch_draft),
      contact_info: {
        hint: clean(l.contact_hint) || null,
        email: clean(l.email) || null,
        phone: clean(l.phone) || null,
        address: clean(l.address) || null,
        contact_name: clean(l.contact_name) || null,
      },
      match_evidence: { evidence: clean(l.evidence), source_url: clean(l.source_url), project_title: projectTitle || null },
      source: "web_radar",
      source_url: clean(l.source_url) || null,
    })).filter((r: any) => r.brand_name && r.source_url);

    let insertedRows: any[] = [];
    if (rows.length) {
      const { data, error } = await supabase.from("sponsor_leads").insert(rows).select("*");
      if (error) console.error("insert sponsor_leads", error);
      insertedRows = data || rows;
    }

    if (project?.id && insertedRows.length) {
      for (const lead of insertedRows) {
        const { data: existing } = await supabase
          .from("event_sponsors")
          .select("id")
          .eq("project_id", project.id)
          .ilike("name", lead.brand_name)
          .maybeSingle();
        if (existing) continue;
        await supabase.from("event_sponsors").insert({
          project_id: project.id,
          created_by: userId,
          name: lead.brand_name,
          tier: "lead",
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          contact_phone: lead.contact_phone,
          deliverables: lead.pitch_draft,
          notes: [lead.reason, lead.match_evidence?.evidence, lead.website || lead.brand_url, lead.address].filter(Boolean).join("\n\n"),
          status: "lead",
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      count: insertedRows.length,
      leads: insertedRows,
      project_id: project?.id || null,
      project_title: projectTitle || null,
      source_count: deduped.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[sponsor-radar]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
