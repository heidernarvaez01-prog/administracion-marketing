import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const OUTPUT_LANGUAGE = "Output language: ENGLISH. Write ALL generated content — section titles, body, tables, slogans, everything — in English.";

// ── Shared output contract: HERO json + 15/6/9 sections, premium HTML fragments ──
function outputFormat(sectionSpecs: string[], heroMeta: string): string {
  return `OUTPUT FORMAT (MANDATORY, no deviations):
Your response is injected into an existing premium HTML template. Do NOT generate <html>, <head>, <style> or <script>. Generate ONLY:

1) First the line ===HERO=== followed by a one-line JSON:
{"eye":"<cluster eyebrow>","title":"<brand name>","sub":"<short subtitle>","meta":[{"strong":"<value>","label":"<label>"} x up to 5]}
${heroMeta}

2) Then the sections, each preceded EXACTLY by its delimiter on its own line: ===SECTION 1=== up to ===SECTION ${sectionSpecs.length}===.

Each section starts with:
<div class="sh"><div class="sh-num">Point NN</div><h2 class="sh-title">TITLE</h2></div>
<div class="body"> ...content... </div>

AVAILABLE CSS CLASSES (the only ones allowed; no inline styles except width:% on .budget-fill):
- Text: h3, h4, p, ul, ol, li, strong, em inside .body
- .callout > .callout-lbl + p (dark highlight)
- .iw > p (selected/headline insight, premium)
- .g2 / .g3 > .card > .card-t + .card-b (card grids)
- .tbl > thead th / tbody td (tables)
- .sl > .sl-num + div(.sl-text + .sl-ctx) (slogan list)
- .cg > .cg-item > .cg-type + .cg-name + .cg-desc + .tag.tag-pauta|.tag-organic|.tag-camp (content grid)
- .bi > .bi-name + .bi-desc, winner adds .bi-winner (big ideas)
- .hl-item > .hl-num + div(.hl-text + .hl-chars) (ad headlines/descriptions)
- .kpi-row > .kpi > .kpi-val + .kpi-lbl (metrics)
- .persona > .persona-header(.persona-avatar + div(.persona-name + .persona-sub)) + content + .empathy > .emp-box > .emp-lbl + .emp-txt
- .budget-row > .budget-label + .budget-bar > .budget-fill(style="width:N%") + .budget-val
- .step > .step-num + .step-content(h4 + p) (steps / summary)
- .cierre > .cierre-quote + .cierre-firma (closing only)

SECTION CONTENT:
${sectionSpecs.join("\n")}

${OUTPUT_LANGUAGE}
Each section must be answered in depth, no filler, no clichés. Premium agency quality.`;
}

// ════════════ CLUSTER 1 — La Fórmula (brand strategy, 15 sections) ════════════
// Original assigned methodology kept intact; only the OUTPUT language is English.
const LA_FORMULA_INSTRUCTIONS = `Actúa como un Estratega Senior de Marca 2026, Creatividad y Paid Media especializado en el mercado específico que aclare la estrategia. Tu trabajo es construir una estrategia de marca completa, ejecutable y derivada de una base conceptual sólida, usando exclusivamente la información que el cliente ha entregado (su briefing), potenciada con su data de campañas en tiempo real como foco secundario.

PROCESO DE ANÁLISIS (lineal y secuencial):
1. Analiza toda la información del cliente a profundidad. Únicamente usando la información puntual dada por el cliente, construye las bases de la estructura llamada "La Fórmula": una arquitectura estratégica lineal que genera inputs, puntos clave y hallazgos para estrategias conscientes, ideas y tácticas de real utilidad.
2. El flujo empieza desde un pilar estratégico: el insight que responde al brief. Plantéate los 10 insights más relevantes, útiles y reales, NO cliché; unos situacionales, otros del mercado y otros de la audiencia. Presenta los diez como evidencia y selecciona el mejor, el más aprovechable y ejecutable.
3. Con el insight, genera un concepto estratégico que funcione como punto de partida racional y ejecutivo (la estrategia central), derivado también del problema del cliente.
4. Desde el insight y el concepto estratégico, genera un objetivo general SMART y 3 específicos SMART.
5. Construye los públicos objetivos: descripción detallada + buyer persona directo, con perfil de consumo y comportamiento según el funnel y mapa de empatía.
6. Genera la estructura de marca: reasons why y reasons to believe, propuestas de valor, valores, pains & gains y diferenciales clave.
7. Crea un concepto creativo impactante, humano, diferente y memorable, con un par de copys centrales y slogan de campaña.
8. Crea un plan táctico 360° priorizando digital, con presupuesto estimado por canal.
9. Crea una parrilla de contenido con 20 creativos: 8 videos, 7 estáticas y 5 carruseles (7 de pauta, 9 de social, 4 de campañas) + descripción de una imagen central de campaña.
10. Plan SEO/Google Ads: cluster de keywords en 4 intenciones, 15 headlines (25-30 chars) y 15 descriptions (75-90 chars), más slogans.
11. Benchmark en tres partes: 10 competidores directos + 10 adyacentes con URL, benchmark SEM, y benchmark de mercado (CPC y adquisición).
12. Big Ideas: 5 ideas virales; elige una y muestra titulares de periódico.
13. Resumen ejecutivo entendible para clientes.
14. Cierra con una frase inspiracional.

Usa la data en tiempo real de paid media SOLO como foco secundario para potenciar el briefing.`;

const LA_FORMULA_SECTIONS = [
  '1. Context & Problems to Solve — main problems from the brief and the strategy territory.',
  '2. Insights & Strategic Pillars — 10 numbered insights by category (audience/situational/market) and the selected one highlighted with .iw.',
  '3. SMART Objectives — general + 3 specific with metrics, timing and link to the problems. Use .kpi-row.',
  '4. Audiences & Buyer Personas — use .persona with .persona-header, .persona-avatar (initials), .empathy with .emp-box, plus funnel behavior.',
  '5. Brand Structure — pains & gains, reasons why/to believe, value propositions. Use .g2/.g3 with .card.',
  '6. Competitive Benchmark — .tbl tables: 10 direct + 10 adjacent competitors with URL and notes, a SEM benchmark and market costs.',
  '7. Strategic Concept — the central rational concept with .callout for the main statement.',
  '8. Creative Concept — name, visual universe, key execution, central line and main copies. Use .callout and .card.',
  '9. 360° Media Plan — media mix with budget per channel using .budget-row/.budget-bar/.budget-fill and recommended total.',
  '10. Slogans & Taglines — main tagline + 10 situational slogans with .sl.',
  '11. Content Grid — 20 pieces with .cg/.cg-item: .cg-type (VIDEO/STATIC/CAROUSEL), .cg-name, .cg-desc and .tag (7 pauta, 9 social, 4 campaign). Close with the central campaign image description (written mockup) in a .callout.',
  '12. SEO + Google Ads — keyword cluster in 4 intent tables, 15 headlines with .hl-item (show char count) and 15 descriptions likewise.',
  '13. Big Ideas — 5 ideas with .bi, the winner with .bi-winner, plus simulated newspaper headlines.',
  '14. Executive Summary — actionable steps with .step, client-friendly language.',
  '15. Closing — use .cierre with .cierre-quote (the inspirational line) and .cierre-firma.',
];

// ════════════ CLUSTER 2 — Tactical Optimization (weekly, 6 sections) ════════════
const TACTICAL_INSTRUCTIONS = `Act as a senior paid media buyer (Meta + Google Ads) with 10 years optimizing real accounts. You are NOT a metrics reporter: you are a surgeon who diagnoses WHERE and WHY performance breaks, and gives concrete, executable orders a junior could run today.

You receive a client's real campaign and ad-set data (this week vs the previous week) and their briefing. Produce a tactical optimization plan for THIS week.

GOLDEN RULES:
- No generic advice. "Improve the creative" is useless. "Ad set X has frequency 6.2 and its CTR dropped from 1.8% to 0.9% in 7 days: clear fatigue, rotate the creative or open a fresh audience" is useful.
- Every recommendation carries a real number from the data and an executable action.
- Diagnose by funnel layer, not by isolated metric.
- Prioritize: max 5 actions ranked by impact/effort. Three surgical actions beat fifteen vague ones.
- Also say what NOT to touch and why.
- If the data is insufficient to conclude something, say so — never invent.`;

const TACTICAL_SECTIONS = [
  "1. Diagnosis of the Week — 3-4 sentences: did the account improve or worsen this week, and what is the root cause? Use a .callout for the headline verdict.",
  "2. Funnel Diagnosis — for each layer give status + numeric evidence using .g2/.card: Audience/Reach (reach, frequency, saturation), Creative (CTR, thruplay, engagement vs the account's own benchmark), Conversion/Offer (good CTR but few conversions = landing/offer issue), Bidding/Efficiency (CPM, CPC, trend).",
  "3. Actions This Week — top 5 prioritized actions as numbered steps using .step. Each: what to do, in which exact campaign/ad set, the number that justifies it, and the expected result.",
  "4. Don't Touch — what is working and must be protected, with the reason, using .g2/.card.",
  "5. Budget Reallocation — if applicable, concrete moves ('shift $X from A to B') with the logic, using .budget-row bars to show current allocation. If not needed, say so clearly.",
  "6. Watchlist — early signals to monitor next week, as a short list. End with a one-line .callout takeaway.",
];

// ════════════ CLUSTER 3 — Keywords & Google Ads (SEM, 9 sections) ════════════
const KEYWORDS_INSTRUCTIONS = `Act as a senior Google Ads & SEM specialist, expert in keyword research and search intent for the client's market. You build campaign structures that convert — not generic word lists.

You receive the client's briefing (what they sell, to whom, where, differentiators, budget) and their Google Ads activity if it exists. Produce a complete, ready-to-launch SEM plan.

GOLDEN RULES:
- Real, business-specific keywords for this market, not obvious filler.
- Group by intent and by theme (logical ad groups), never a flat list.
- Include negative keywords — as important as the positive ones.
- Headlines and descriptions must respect Google Ads character limits and reflect the brief's tone.
- If real data exists, use it to prioritize (which keywords already perform, which waste budget).`;

const KEYWORDS_SECTIONS = [
  "1. SEM Strategy — overall approach based on the client's budget and objective. Use a .callout for the core strategic statement.",
  "2. Keyword Clusters by Intent — 4 groups in .tbl tables: Transactional, Commercial/Investigation, Informational, Brand/Navigational. Each keyword with estimated volume, competition and suggested match type.",
  "3. Ad Groups — proposed themed grouping using .g2/.card, each with its central theme and core keywords.",
  "4. Negative Keywords — exclusion list as .tbl or list, to avoid wasting budget.",
  "5. Headlines — 15 headlines (each ≤30 characters, show char count) using .hl-item, ready to paste.",
  "6. Descriptions — 15 descriptions (each ≤90 characters, show char count) using .hl-item, ready to paste.",
  "7. Extensions — suggested sitelinks, callouts and structured snippets using .g2/.card.",
  "8. SEM Benchmark — approximate market CPC and competition level for the key keywords, in a .tbl table.",
  "9. Quick Wins — 3 immediate actions if campaigns are already running, using .step. If none running, give 3 launch priorities instead.",
];

const HERO_META_GENERIC = '(the 5 meta items: star product/service, main market, monthly budget, target segment, and the cluster type)';

interface ClusterConfig { eyebrow: string; instructions: string; sections: string[] }
const CLUSTERS: Record<string, ClusterConfig> = {
  la_formula_v2: { eyebrow: "La Fórmula™ · Brand Strategy 2026", instructions: LA_FORMULA_INSTRUCTIONS, sections: LA_FORMULA_SECTIONS },
  tactical_optimization: { eyebrow: "Tactical Optimization · Weekly Plan", instructions: TACTICAL_INSTRUCTIONS, sections: TACTICAL_SECTIONS },
  keywords_google_ads: { eyebrow: "Keywords & Google Ads · SEM Plan", instructions: KEYWORDS_INSTRUCTIONS, sections: KEYWORDS_SECTIONS },
};

// First day of the current calendar month (for the once-per-month limit)
function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return jsonError("Unauthorized", 401);
    const userId = userData.user.id;

    const { clientId, clusterKey: rawKey } = await req.json();
    if (!clientId || typeof clientId !== "string") return jsonError("clientId is required", 400);
    const clusterKey = (typeof rawKey === "string" && CLUSTERS[rawKey]) ? rawKey : "la_formula_v2";
    const cluster = CLUSTERS[clusterKey];

    // Client must belong to the user
    const { data: client } = await supabase
      .from("audit_clients")
      .select("id, name, description, user_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client || client.user_id !== userId) return jsonError("Client not found", 404);

    // ── Once-per-month limit per client + cluster ──
    const { data: monthRuns } = await supabase
      .from("cluster_runs")
      .select("id")
      .eq("client_id", clientId)
      .eq("cluster_key", clusterKey)
      .gte("created_at", monthStartIso())
      .limit(1);
    if (monthRuns && monthRuns.length > 0) {
      return jsonError("This cluster has already been run for this client this month. It will be available again next month.", 429);
    }

    // Brand brief — primary input
    const { data: brief } = await supabase
      .from("brand_briefs").select("*").eq("client_id", clientId).maybeSingle();
    const briefFields = brief
      ? Object.fromEntries(Object.entries(brief).filter(([k, v]) =>
          !["id", "user_id", "client_id", "account_id", "created_at", "updated_at"].includes(k) && v !== null && v !== ""))
      : {};
    if (Object.keys(briefFields).length < 3) {
      return jsonError("The Brand Brief for this client is empty or too short. Complete it first — the cluster is built from the briefing.", 400);
    }

    // Real-time campaign activity for THIS client (secondary input)
    const { data: audits } = await supabase
      .from("audit_records")
      .select("account_id, campaign_name, platform, presupuesto_total, fecha_inicio, fecha_fin")
      .eq("client_id", clientId);
    const campaignNames = Array.from(new Set((audits ?? []).map((a) => a.campaign_name).filter(Boolean)));
    let metrics: any[] = [];
    if (campaignNames.length) {
      const { data } = await supabase
        .from("meta_datos")
        .select("campaign_name, adset_name, plataforma, fecha, total_cost, impressions, clicks, reach, ctr_all, cpc, cpm, conversions, link_clicks, interactions, frequency, objective")
        .in("campaign_name", campaignNames)
        .order("fecha", { ascending: false })
        .limit(800);
      metrics = data ?? [];
    }

    // Aggregate by campaign (and keep recent ad-set rows for tactical depth)
    const byCampaign = new Map<string, any>();
    for (const m of metrics) {
      const k = m.campaign_name;
      const cur = byCampaign.get(k) ?? { campaign: k, platform: m.plataforma, cost: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0, days: 0 };
      cur.cost += Number(m.total_cost ?? 0);
      cur.impressions += Number(m.impressions ?? 0);
      cur.clicks += Number(m.clicks ?? 0);
      cur.reach += Number(m.reach ?? 0);
      cur.conversions += Number(m.conversions ?? 0);
      cur.days += 1;
      byCampaign.set(k, cur);
    }
    const campaignSummary = Array.from(byCampaign.values()).map((c) => ({
      ...c,
      ctr: c.impressions ? +(100 * c.clicks / c.impressions).toFixed(2) : 0,
      cpc: c.clicks ? +(c.cost / c.clicks).toFixed(2) : 0,
      cpm: c.impressions ? +(1000 * c.cost / c.impressions).toFixed(2) : 0,
    }));

    const userPrompt = `CLIENT: ${client.name}${client.description ? ` — ${client.description}` : ""}

CLIENT BRIEFING (primary source and center of the whole strategy):
\`\`\`json
${JSON.stringify(briefFields, null, 2)}
\`\`\`

REAL-TIME PAID MEDIA ACTIVITY (secondary focus, only to ground and sharpen):
\`\`\`json
${JSON.stringify({ auditedCampaigns: audits ?? [], performance: campaignSummary, recentRows: metrics.slice(0, 120) }, null, 2)}
\`\`\`

Build the deliverable for this client following the process and the output format to the letter.`;

    const system = `${cluster.instructions}\n\n${outputFormat(cluster.sections, HERO_META_GENERIC).replace("<cluster eyebrow>", cluster.eyebrow)}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 16000,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiRes.status === 429) return jsonError("AI rate limit reached. Try again in a few seconds.", 429);
    if (!aiRes.ok || !aiRes.body) {
      const t = await aiRes.text();
      console.error("OpenAI error", aiRes.status, t);
      return jsonError("AI service error", 500);
    }

    // Translate OpenAI SSE deltas into Anthropic-shaped `content_block_delta`
    // events so the existing client parser keeps working.
    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload);
                const text = evt?.choices?.[0]?.delta?.content;
                if (typeof text === "string" && text.length) {
                  const out = { type: "content_block_delta", delta: { text } };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
                }
              } catch { /* ignore */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error(e);
    return jsonError(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
