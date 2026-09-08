import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatCompletion } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignData } = await req.json();

    // Fetch brand brief context for the account, if available
    let briefBlock = "";
    try {
      const accountId = campaignData?.accountId;
      if (accountId) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_KEY) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/brand_briefs?account_id=eq.${encodeURIComponent(accountId)}&select=*`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
          );
          if (r.ok) {
            const rows = await r.json();
            const b = Array.isArray(rows) ? rows[0] : null;
            if (b) {
              const lines: string[] = [];
              const push = (label: string, v: any) => { if (v != null && String(v).trim() !== "") lines.push(`- ${label}: ${v}`); };
              push("Marca", b.marca);
              push("Sitio web", b.sitio_web);
              push("Mercado objetivo", b.mercado_objetivo);
              push("Necesidad principal", b.necesidad_principal);
              push("Descripción del proyecto", b.descripcion_proyecto);
              push("Público objetivo", b.publico_objetivo);
              push("Fundamentos de marca", b.fundamentos_marca);
              push("Promesa de marca", b.promesa_marca);
              push("Reasons why", b.reasons_why);
              push("Personalidad / arquetipo", b.personalidad_marca);
              push("Estilo y tono", b.estilo_tono);
              push("Diferenciador", b.diferenciador);
              push("Valores", b.valores_marca);
              push("Insights", b.insights);
              push("Benchmark", b.benchmark);
              push("Presupuesto de campaña (brief)", b.presupuesto_campana);
              if (lines.length) briefBlock = `\n\n### Contexto de marca\n${lines.join("\n")}\n`;
            }
          }
        }
      }
    } catch (err) {
      console.error("brief fetch failed", err);
    }

    const systemPrompt = `You are an expert digital advertising analyst focused on budget pacing.
Generate a diagnosis of EXACTLY 3 lines centered on budget risk.
- Line 1: Risk level (Critical/Moderate/Low) and the main reason.
- Line 2: An insight about spend distribution or performance (CTR, CPC).
- Line 3: A concrete, actionable recommendation.
When brand context is available, weave it in (tone, audience, differentiator) into the insight and the recommendation.
Be direct, use the numeric data from the context. Respond ONLY in English.
At the end, on a separate line, write ONLY one of these tags: [RIESGO_CRITICO] or [RIESGO_MODERADO] or [SIN_RIESGO]`;

    const userPrompt = `Campaign audit data:
- Campaign: ${campaignData.campaignName}
- Platform: ${campaignData.platform || 'Not specified'}
- Approved Budget: $${campaignData.presupuestoTotal}
- Actual Spend: $${campaignData.gastoActual}
- Remaining Budget: $${campaignData.presupuestoRestante}
- Days Elapsed: ${campaignData.diasTranscurridos}
- Days Left: ${campaignData.diasRestantes}
- Pacing: ${campaignData.pacingStatus} (${campaignData.pacingPct > 0 ? '+' : ''}${campaignData.pacingPct}%)
- Current Daily Spend: $${campaignData.gastoDiarioActual}
- Ideal Daily Spend: $${campaignData.presupuestoDiarioIdeal}
- Avg CTR: ${campaignData.ctr}%
- Avg CPC: $${campaignData.cpc}
- Impressions: ${campaignData.impressions}
- Clicks: ${campaignData.clicks}
- Reach: ${campaignData.reach}
${briefBlock}
Generate the 3-line diagnosis + risk tag.`;

    const result = await chatCompletion({
      model: "gpt-4o-mini",
      maxTokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    if (!result.ok) {
      if (result.rateLimited) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(result.error || "OpenAI API error");
    }

    const content = result.content;

    let riskLevel: "critical" | "moderate" | "none" = "none";
    if (content.includes("[RIESGO_CRITICO]")) riskLevel = "critical";
    else if (content.includes("[RIESGO_MODERADO]")) riskLevel = "moderate";

    const insight = content
      .replace(/\[RIESGO_CRITICO\]/g, "")
      .replace(/\[RIESGO_MODERADO\]/g, "")
      .replace(/\[SIN_RIESGO\]/g, "")
      .trim();

    return new Response(JSON.stringify({ insight, riskLevel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audit-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
