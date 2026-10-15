import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Antes llamaba a Windsor.ai en vivo, sin login y sin filtrar por cuenta —
// cualquiera con la anon key veía el gasto agregado de las 7 cuentas
// conectadas. Ahora lee meta_datos (ya sincronizada a diario por
// sync-meta-datos) con el JWT de quien llama, para que RLS filtre solo lo
// que esa cuenta/cliente/agencia puede ver. Sin sesión válida -> 401.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface DailyTotalRow {
  fecha: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
}

interface CampaignTotalRow {
  client_id: string;
  account_id: string;
  currency: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  first_fecha: string;
  last_fecha: string;
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((Number(n || 0) + Number.EPSILON) * factor) / factor;
}

// Preset heredado de windsor-client.js (compaign.js/analytics.js lo siguen
// mandando tal cual) -> ventana en días para los RPC nuevos.
function daysFromPreset(datePreset: string | null): number {
  if (datePreset === "last_7d") return 7;
  if (datePreset === "last_30d") return 30;
  return 90; // default histórico de esta función (last_90d)
}

// PostgREST corta cualquier select en 1000 filas por página, sin avisar —
// confirmado con Kemmerling: 1357 filas en 90 días en v_meta_daily_campaign.
// Sin paginar, eso trunca los últimos días/campañas en silencio. Se pagina
// con .range() en orden estable (fecha, campaign_id) hasta que una página
// traiga menos de PAGE_SIZE filas, con un tope de seguridad: si se supera,
// error explícito en vez de datos incompletos.
const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    all.push(...rows);
    if (all.length > MAX_ROWS) {
      throw new Error(`v_meta_daily_campaign devolvió más de ${MAX_ROWS} filas — acorta el rango antes de seguir (sin esto, mostraríamos datos truncados).`);
    }
    if (rows.length < PAGE_SIZE) return all;
    offset += PAGE_SIZE;
  }
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Explícito: con solo la anon key (sin sesión real) esto no debe dar
    // 200 con datos vacíos, debe dar 401 — RLS sola no distingue los casos.
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: true, status: 401, mensaje: "Sesión requerida." }, 401);
    }

    const reqUrl = new URL(req.url);
    const days = daysFromPreset(reqUrl.searchParams.get("date_preset"));
    const clientId = reqUrl.searchParams.get("client_id") || null;
    const requestedCurrency = reqUrl.searchParams.get("currency") || null;
    const includeRaw = reqUrl.searchParams.get("raw") === "1";

    // Motor de auditoría/pacing (auditoria.js): necesita gasto por día Y
    // por campaña, no solo totales. v_meta_daily_campaign ya tiene ese
    // grano exacto (RLS-scoped), pero sin acotar por cliente una consulta
    // así podría pasar las 1000 filas que corta PostgREST — por eso
    // client_id es obligatorio en este modo (auditoria.html siempre
    // navega con un client_id en la URL).
    if (includeRaw) {
      if (!clientId) {
        return jsonResponse({ error: true, status: 400, mensaje: "raw=1 requiere client_id." }, 400);
      }
      const rows = await fetchAllRows<{
        fecha: string; campaign_id: string; account_id: string; campaign_name: string;
        spend: number; impressions: number; clicks: number;
      }>((from, to) =>
        supabase
          .from("v_meta_daily_campaign")
          .select("fecha, campaign_id, account_id, campaign_name, spend, impressions, clicks")
          .eq("client_id", clientId)
          // Orden con desempate completo: dos filas nunca quedan en el
          // mismo lugar relativo entre páginas (evita saltos/repetidos si
          // (fecha, campaign_id) se repite entre cuentas o adsets).
          .order("fecha", { ascending: true })
          .order("campaign_id", { ascending: true })
          .order("account_id", { ascending: true })
          .order("campaign_name", { ascending: true })
          .range(from, to),
      );
      const dailyCampaignTotals = rows.map((r) => ({
        date: r.fecha,
        campaign: r.campaign_name,
        datasource: "META",
        clicks: round(r.clicks, 0),
        spend: round(r.spend),
        impressions: round(r.impressions, 0),
      }));
      const campaignNames = Array.from(new Set(rows.map((r) => r.campaign_name).filter(Boolean))).sort();

      // El motor de auditoría solo necesita esto — no hace falta correr
      // también los RPC de totales/KPIs que usan compaign.html/analytics.html.
      return jsonResponse({
        error: false,
        generatedAt: new Date().toISOString(),
        dailyCampaignTotals,
        campaignNames,
      });
    }

    const [dailyRes, campaignRes, adRes, objRes] = await Promise.all([
      supabase.rpc("meta_daily_totals", { _days: days, _client_id: clientId }),
      supabase.rpc("meta_campaign_totals", { _days: days, _client_id: clientId }),
      supabase.rpc("meta_ad_totals", { _days: days, _client_id: clientId }),
      supabase.rpc("meta_objective_totals", { _days: days, _client_id: clientId }),
    ]);
    if (adRes.error) throw adRes.error;
    if (objRes.error) throw objRes.error;

    if (dailyRes.error) throw dailyRes.error;
    if (campaignRes.error) throw campaignRes.error;

    const dailyRows: DailyTotalRow[] = dailyRes.data || [];
    const campaignRows: CampaignTotalRow[] = campaignRes.data || [];

    const currencies = Array.from(
      new Set([...dailyRows.map((r) => r.currency), ...campaignRows.map((r) => r.currency)]),
    ).sort();

    // Nunca se suman monedas distintas: se muestra una por vez. Por defecto
    // la de mayor gasto; ?currency=XXX permite elegir otra (el front la
    // ofrece como selector cuando currencies.length > 1 — nunca se oculta
    // en silencio que hay más de una).
    const spendByCurrency = new Map<string, number>();
    for (const r of dailyRows) spendByCurrency.set(r.currency, (spendByCurrency.get(r.currency) ?? 0) + Number(r.spend || 0));
    const topCurrency = currencies.length
      ? [...spendByCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currencies[0]
      : "USD";
    const primaryCurrency = requestedCurrency && currencies.includes(requestedCurrency) ? requestedCurrency : topCurrency;

    const dailyPrimary = dailyRows.filter((r) => r.currency === primaryCurrency).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const campaignsPrimary = campaignRows.filter((r) => r.currency === primaryCurrency).sort((a, b) => b.spend - a.spend);

    const totalSpend = dailyPrimary.reduce((acc, r) => acc + Number(r.spend || 0), 0);
    const totalClicks = dailyPrimary.reduce((acc, r) => acc + Number(r.clicks || 0), 0);
    const totalImpressions = dailyPrimary.reduce((acc, r) => acc + Number(r.impressions || 0), 0);
    const totalCampaigns = campaignsPrimary.length;
    const ctr = totalImpressions > 0 ? round((totalClicks / totalImpressions) * 100, 2) : 0;
    const lastFecha = dailyPrimary.length ? dailyPrimary[dailyPrimary.length - 1].fecha : null;
    const prevFecha = dailyPrimary.length > 1 ? dailyPrimary[dailyPrimary.length - 2].fecha : null;
    const spendOn = (fecha: string | null) =>
      fecha === null ? 0 : round(dailyPrimary.filter((r) => r.fecha === fecha).reduce((acc, r) => acc + Number(r.spend || 0), 0));

    const kpis = {
      totalCampaigns,
      totalClicks: round(totalClicks, 0),
      totalImpressions: round(totalImpressions, 0),
      totalSpend: round(totalSpend),
      spendToday: spendOn(lastFecha),
      spendYesterday: spendOn(prevFecha),
      ctr,
    };

    const clickSummary = {
      labels: dailyPrimary.map((r) => r.fecha),
      data: dailyPrimary.map((r) => round(r.clicks, 0)),
    };
    const spendSummary = {
      labels: dailyPrimary.map((r) => r.fecha),
      data: dailyPrimary.map((r) => round(r.spend)),
    };

    // "status" heredado de la versión vieja: activa si tuvo gasto en los
    // últimos 3 días con datos disponibles.
    const fechaCorte = lastFecha
      ? new Date(new Date(lastFecha).getTime() - 3 * 24 * 60 * 60 * 1000)
      : null;

    const campaigns = campaignsPrimary.map((c) => ({
      campaign: c.campaign_name || "(sin nombre)",
      datasource: "META", // meta_datos no distingue red (siempre 'META')
      spend: round(c.spend),
      clicks: round(c.clicks, 0),
      impressions: round(c.impressions, 0),
      ctr: c.impressions > 0 ? round((c.clicks / c.impressions) * 100, 2) : 0,
      status: fechaCorte && new Date(c.last_fecha) >= fechaCorte ? "On Going" : "Expired",
      lastDate: c.last_fecha,
      clientId: c.client_id,
      accountId: c.account_id,
      leads: round((c as unknown as { leads: number }).leads, 0),
      conversations: round((c as unknown as { messaging_conversations: number }).messaging_conversations, 0),
    }));

    // Anuncios reales (nivel ad_id) en la moneda elegida — nunca se mezclan monedas.
    type AdRow = { account_id: string; currency: string; campaign_name: string; ad_id: string; ad_name: string;
      spend: number; impressions: number; clicks: number; spend_recent: number; spend_prior: number; last_fecha: string };
    const adsPrimary = ((adRes.data || []) as AdRow[]).filter((r) => r.currency === primaryCurrency);
    const mapAd = (a: AdRow) => ({
      campaign: a.campaign_name || "(sin campaña)",
      adName: a.ad_name || a.ad_id,
      datasource: "META · últ. actividad " + a.last_fecha,
      spend: round(a.spend),
      clicks: round(a.clicks, 0),
      impressions: round(a.impressions, 0),
      trend: round(Number(a.spend_recent || 0) - Number(a.spend_prior || 0)),
    });
    const topAds = adsPrimary.slice(0, 5).map(mapAd);
    const trendingAds = adsPrimary.map(mapAd).filter((a) => a.trend > 0).sort((x, y) => y.trend - x.trend).slice(0, 5);

    // Clics por objetivo (los clics sí se suman entre monedas: no son dinero).
    type ObjRow = { objective: string; clicks: number; spend: number; currency: string };
    const clicksByObj = new Map<string, number>();
    for (const r of (objRes.data || []) as ObjRow[]) clicksByObj.set(r.objective, (clicksByObj.get(r.objective) ?? 0) + Number(r.clicks || 0));
    const objTotal = [...clicksByObj.values()].reduce((a, b) => a + b, 0);
    const objSorted = [...clicksByObj.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const objectiveBreakdown = {
      labels: objSorted.map(([k]) => k.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase()),
      series: objSorted.map(([, v]) => (objTotal > 0 ? round((v / objTotal) * 100, 1) : 0)),
    };

    const engagementByPlatform = {
      categories: dailyPrimary.slice(-14).map((r) => r.fecha),
      series: [{ name: "Clics Meta", data: dailyPrimary.slice(-14).map((r) => round(r.clicks, 0)) }],
    };

    return jsonResponse({
      error: false,
      generatedAt: new Date().toISOString(),
      currency: primaryCurrency,
      currencies,
      kpis,
      lastFecha,
      prevFecha,
      clickSummary,
      spendSummary,
      campaigns,
      topAds,
      trendingAds,
      plataformas: [],
      objectiveBreakdown,
      ctrGauge: ctr,
      engagementByPlatform,
    });
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in windsor-metrics function:", error);
    return jsonResponse({ error: true, status: 500, mensaje }, 500);
  }
});
