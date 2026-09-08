import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PLATAFORMAS, type Plataforma } from "./plataformas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Campos base validados contra la cuenta real de Windsor.ai (no cambiar
// sin volver a validar en la cuenta, algunos connectors no traen todos).
const WINDSOR_FIELDS = [
  "date",
  "datasource",
  "account_name",
  "source",
  "campaign",
  "adset_name",
  "ad_name",
  "clicks",
  "spend",
  "impressions",
  "cpc",
  "cpm",
  "objective",
  "campaign_objective",
  "image_url",
].join(",");

const WINDSOR_URL = "https://connectors.windsor.ai/all";
const DEFAULT_DATE_PRESET = "last_90d";

interface WindsorRow {
  date: string;
  datasource: string;
  account_name?: string;
  source?: string;
  campaign?: string;
  adset_name?: string;
  ad_name?: string;
  clicks?: number;
  spend?: number;
  impressions?: number;
  cpc?: number;
  cpm?: number;
  objective?: string;
  campaign_objective?: string;
  image_url?: string;
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function emptyPlataformaMetrics(p: Plataforma) {
  return {
    id: p.id,
    nombre: p.nombre,
    conectado: false,
    clicks: 0,
    spend: 0,
    impressions: 0,
    cpc: 0,
    cpm: 0,
    campañas: 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const WINDSOR_API_KEY = Deno.env.get("WINDSOR_API_KEY");

    if (!WINDSOR_API_KEY) {
      return jsonResponse(
        { error: true, status: 500, mensaje: "WINDSOR_API_KEY no está configurada en las secrets de Supabase." },
        500,
      );
    }

    // Permite override puntual desde el frontend (?date_preset=last_30d),
    // pero por defecto usa el rango ya validado.
    const reqUrl = new URL(req.url);
    const datePreset = reqUrl.searchParams.get("date_preset") || DEFAULT_DATE_PRESET;

    const windsorUrl = new URL(WINDSOR_URL);
    windsorUrl.searchParams.set("fields", WINDSOR_FIELDS);
    windsorUrl.searchParams.set("date_preset", datePreset);

    const windsorRes = await fetch(windsorUrl.toString(), {
      headers: { "X-Api-Key": WINDSOR_API_KEY },
    });

    if (!windsorRes.ok) {
      const detalle = await windsorRes.text().catch(() => "");
      return jsonResponse(
        {
          error: true,
          status: windsorRes.status,
          mensaje: `Windsor.ai respondió con error ${windsorRes.status}${detalle ? `: ${detalle.slice(0, 500)}` : ""}`,
        },
        windsorRes.status,
      );
    }

    const payload = await windsorRes.json().catch(() => null);
    const rows: WindsorRow[] = Array.isArray(payload?.data) ? payload.data : [];

    // ------------------------------------------------------------------
    // 1) Plataformas esperadas vs. lo que realmente llegó de Windsor
    // ------------------------------------------------------------------
    const plataformas = PLATAFORMAS.map((p) => {
      const filas = rows.filter((r) => r.datasource === p.id || r.source === p.id);

      if (filas.length === 0) {
        return emptyPlataformaMetrics(p);
      }

      const clicks = filas.reduce((acc, r) => acc + num(r.clicks), 0);
      const spend = filas.reduce((acc, r) => acc + num(r.spend), 0);
      const impressions = filas.reduce((acc, r) => acc + num(r.impressions), 0);
      const campañas = new Set(filas.map((r) => r.campaign).filter(Boolean)).size;

      return {
        id: p.id,
        nombre: p.nombre,
        conectado: true,
        clicks: round(clicks, 0),
        spend: round(spend, 2),
        impressions: round(impressions, 0),
        // cpc/cpm recalculados desde los totales (más preciso que promediar
        // el cpc/cpm fila por fila).
        cpc: clicks > 0 ? round(spend / clicks, 4) : 0,
        cpm: impressions > 0 ? round((spend / impressions) * 1000, 4) : 0,
        campañas,
      };
    });

    // Filas de plataformas NO listadas en plataformas.ts (por si Windsor
    // trae un connector nuevo que todavía no agregamos) — se reportan
    // aparte para que se note en la respuesta, sin romper el shape fijo.
    const idsEsperados = new Set(PLATAFORMAS.map((p) => p.id));
    const otrasPlataformas = Array.from(
      new Set(rows.map((r) => r.datasource).filter((d) => d && !idsEsperados.has(d))),
    );

    // ------------------------------------------------------------------
    // 2) KPIs generales
    // ------------------------------------------------------------------
    const totalClicks = rows.reduce((acc, r) => acc + num(r.clicks), 0);
    const totalImpressions = rows.reduce((acc, r) => acc + num(r.impressions), 0);
    const totalSpend = rows.reduce((acc, r) => acc + num(r.spend), 0);
    const totalCampaigns = new Set(rows.map((r) => r.campaign).filter(Boolean)).size;
    const ctr = totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 2) : 0;

    const fechasOrdenadas = Array.from(new Set(rows.map((r) => r.date).filter(Boolean))).sort();
    const ultimaFecha = fechasOrdenadas[fechasOrdenadas.length - 1] ?? null;
    const fechaAnterior = fechasOrdenadas[fechasOrdenadas.length - 2] ?? null;

    const spendPorFecha = (fecha: string | null) =>
      fecha === null ? 0 : round(rows.filter((r) => r.date === fecha).reduce((acc, r) => acc + num(r.spend), 0), 2);

    const kpis = {
      totalCampaigns,
      totalClicks: round(totalClicks, 0),
      totalImpressions: round(totalImpressions, 0),
      totalSpend: round(totalSpend, 2),
      // "Spends Today/Yesterday" del template: usamos la última y penúltima
      // fecha con datos (Windsor puede tener 1-2 días de retraso).
      spendToday: spendPorFecha(ultimaFecha),
      spendYesterday: spendPorFecha(fechaAnterior),
      ctr,
    };

    // ------------------------------------------------------------------
    // 3) Series por día — para Chart.js (chart-chartjs "labels"/"datasets")
    //    Se usan los últimos 20 puntos para calzar con el eje X original
    //    de analytics.html ("01".."20").
    // ------------------------------------------------------------------
    const ultimasFechas = fechasOrdenadas.slice(-20);

    const clickSummary = {
      labels: ultimasFechas,
      data: ultimasFechas.map((f) =>
        round(rows.filter((r) => r.date === f).reduce((acc, r) => acc + num(r.clicks), 0), 0),
      ),
    };

    // No existe un campo de "conversiones" en los fields que valida esta
    // cuenta de Windsor (solo clicks/spend/impressions/cpc/cpm). En vez de
    // inventar un número, este panel usa gasto diario real. Ver README del
    // Paso 5 / mensaje al usuario para el detalle.
    const spendSummary = {
      labels: ultimasFechas,
      data: ultimasFechas.map((f) =>
        round(rows.filter((r) => r.date === f).reduce((acc, r) => acc + num(r.spend), 0), 2),
      ),
    };

    // ------------------------------------------------------------------
    // 4) Distribución por objetivo de campaña — para el radialBar
    //    "Goal Statistic" (chartCircle)
    // ------------------------------------------------------------------
    const clicksPorObjetivo = new Map<string, number>();
    for (const r of rows) {
      const key = r.campaign_objective || r.objective || "Sin objetivo";
      clicksPorObjetivo.set(key, (clicksPorObjetivo.get(key) ?? 0) + num(r.clicks));
    }
    const objetivosOrdenados = Array.from(clicksPorObjetivo.entries()).sort((a, b) => b[1] - a[1]);
    const top3Objetivos = objetivosOrdenados.slice(0, 3);
    const totalClicksObjetivo = objetivosOrdenados.reduce((acc, [, v]) => acc + v, 0);

    const objectiveBreakdown = {
      labels: top3Objetivos.map(([label]) => label),
      series: top3Objetivos.map(([, v]) => (totalClicksObjetivo > 0 ? round((v / totalClicksObjetivo) * 100, 0) : 0)),
    };

    // CTR global como gauge único (chartratio)
    const ctrGauge = ctr;

    // ------------------------------------------------------------------
    // 5) Clicks por día y por plataforma — para el ApexCharts columnChart
    //    "Ads Engagement" (categorías = fechas, series = plataformas)
    // ------------------------------------------------------------------
    const engagementByPlatform = {
      categories: ultimasFechas,
      series: PLATAFORMAS.map((p) => ({
        name: p.nombre,
        data: ultimasFechas.map((f) =>
          round(
            rows
              .filter((r) => (r.datasource === p.id || r.source === p.id) && r.date === f)
              .reduce((acc, r) => acc + num(r.clicks), 0),
            0,
          ),
        ),
      })),
    };

    // ------------------------------------------------------------------
    // 6) Top anuncios por gasto — para "Most Performed Ads" / "Trending Ads"
    // ------------------------------------------------------------------
    const porAnuncio = new Map<
      string,
      { adName: string; campaign: string; datasource: string; imageUrl: string; spend: number; clicks: number; impressions: number }
    >();
    for (const r of rows) {
      const key = `${r.datasource}::${r.campaign}::${r.ad_name}`;
      const acc = porAnuncio.get(key) ?? {
        adName: r.ad_name || "(sin nombre)",
        campaign: r.campaign || "(sin campaña)",
        datasource: r.datasource,
        imageUrl: r.image_url || "",
        spend: 0,
        clicks: 0,
        impressions: 0,
      };
      acc.spend += num(r.spend);
      acc.clicks += num(r.clicks);
      acc.impressions += num(r.impressions);
      if (!acc.imageUrl && r.image_url) acc.imageUrl = r.image_url;
      porAnuncio.set(key, acc);
    }
    const topAds = Array.from(porAnuncio.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((a) => ({
        ...a,
        spend: round(a.spend, 2),
        clicks: round(a.clicks, 0),
        impressions: round(a.impressions, 0),
      }));

    // ------------------------------------------------------------------
    // 7) Campañas agrupadas — para compaign.html (lista de campañas)
    // ------------------------------------------------------------------
    const porCampaña = new Map<
      string,
      { campaign: string; datasource: string; spend: number; clicks: number; impressions: number; lastDate: string }
    >();
    for (const r of rows) {
      const key = `${r.datasource}::${r.campaign}`;
      const acc = porCampaña.get(key) ?? {
        campaign: r.campaign || "(sin nombre)",
        datasource: r.datasource,
        spend: 0,
        clicks: 0,
        impressions: 0,
        lastDate: r.date,
      };
      acc.spend += num(r.spend);
      acc.clicks += num(r.clicks);
      acc.impressions += num(r.impressions);
      if (r.date > acc.lastDate) acc.lastDate = r.date;
      porCampaña.set(key, acc);
    }

    // "On Going" si tuvo actividad en los últimos 3 días de datos
    // disponibles (Windsor puede ir 1-2 días atrás); si no, "Expired".
    const fechaCorte = fechasOrdenadas.length
      ? new Date(new Date(fechasOrdenadas[fechasOrdenadas.length - 1]).getTime() - 3 * 24 * 60 * 60 * 1000)
      : null;

    const campaigns = Array.from(porCampaña.values())
      .map((c) => ({
        campaign: c.campaign,
        datasource: c.datasource,
        spend: round(c.spend, 2),
        clicks: round(c.clicks, 0),
        impressions: round(c.impressions, 0),
        ctr: c.impressions > 0 ? round((c.clicks / c.impressions) * 100, 2) : 0,
        status: fechaCorte && new Date(c.lastDate) >= fechaCorte ? "On Going" : "Expired",
        lastDate: c.lastDate,
      }))
      .sort((a, b) => b.spend - a.spend);

    // ------------------------------------------------------------------
    // Shape final — siempre el mismo, haya o no plataformas conectadas.
    // ------------------------------------------------------------------
    return jsonResponse({
      error: false,
      generatedAt: new Date().toISOString(),
      datePreset,
      plataformas,
      otrasPlataformasDetectadas: otrasPlataformas, // connectors nuevos no listados en plataformas.ts
      kpis,
      clickSummary,
      spendSummary,
      objectiveBreakdown,
      ctrGauge,
      engagementByPlatform,
      topAds,
      campaigns,
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in windsor-metrics function:", error);
    return jsonResponse({ error: true, status: 500, mensaje }, 500);
  }
});
