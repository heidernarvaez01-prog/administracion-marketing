import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chatCompletion } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Antes: service-role key + accountId del body sin validar — cualquiera
    // con la anon key podía leer el brand_brief de cualquier cuenta (IDOR).
    // Ahora exige sesión real y, si llega accountId, usa el JWT del caller
    // para que RLS decida si puede verlo — nunca se bypassa con service role.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sesión requerida." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaignData } = await req.json();

    // Fetch brand brief context for the account, if available
    let briefBlock = "";
    try {
      const accountId = campaignData?.accountId;
      if (accountId) {
        const { data: rows, error: briefErr } = await supabase
          .from("brand_briefs")
          .select("*")
          .eq("account_id", accountId);
        if (!briefErr) {
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
