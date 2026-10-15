import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  BACKFILL_WINDOW_DAYS,
  classifyAccounts,
  latestActivityDate,
  maxDate,
  sanitizeError,
  summarizeProbe,
  toIsoDate,
  windsorRangeParams,
  type AdAccount,
  type ProbeSummary,
} from "./sync-plan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

// Field list verified against https://windsor.ai/data-field/all/ (facebook
// connector) on 2026-08-10 — every field below is confirmed available for
// the "facebook" datasource. Grouped by what they unlock:
const WINDSOR_FIELDS = [
  // Identity — was name-only before; IDs make the campaign_name join robust
  // and unlock ad/creative-level drill-down (fixes CLAUDE.md P2 "match robusto").
  "account_id", "date", "account_name", "campaign", "campaign_id",
  "adset_name", "adset_id", "ad_id", "ad_name",
  "campaign_objective", "adsset_optimization_goal",
  // Core delivery + pacing (unchanged)
  "spend", "clicks", "impressions", "reach", "ctr", "link_clicks",
  "frequency", "cpm", "actions_post_engagement",
  "video_thruplay_watched_actions_video_view",
  // Budget signal — always null before because these fields were never
  // requested. Lets the app compare "approved" vs "what Meta actually has
  // programmed" instead of only tracking spend.
  "campaign_daily_budget", "campaign_lifetime_budget", "campaign_budget_remaining",
  "adset_daily_budget", "adset_lifetime_budget", "adset_budget_remaining",
  // Real campaign/adset schedule (UNIX timestamps) — replaces the
  // always-null campaign_start_date/end_date columns.
  "campaign_start_time", "campaign_stop_time", "adset_start_time", "adset_end_time",
  // Conversion depth — generic "conversions" doesn't say what kind. These
  // give purchase/lead/checkout counts + values, and real ROAS.
  "conversions", "actions_omni_purchase", "actions_omni_add_to_cart",
  "actions_omni_initiated_checkout", "action_values_omni_purchase", "action_values_lead",
  "purchase_roas_omni_purchase", "website_purchase_roas_offsite_conversion_fb_pixel_purchase",
  // Ad quality diagnostics — Meta's own relevance signals, a much better
  // creative-fatigue indicator than the frequency+CTR heuristic alone.
  "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
  "unique_clicks", "unique_ctr",
  // Funnel step between click and conversion. NOTE: "publisher_platform" is
  // deliberately NOT requested here — Windsor's facebook connector rejects
  // any request that mixes a breakdown field (publisher_platform) with the
  // "omni" (actions_omni_*) and "ranking" (quality_ranking, etc.) fields
  // above, returning HTTP 400. Confirmed by direct API testing on 2026-08-11.
  // Getting placement-level data back would require a SEPARATE sync (its own
  // Windsor request without omni/ranking fields, written to a different
  // table) rather than adding it to this one. See CLAUDE.md.
  "actions_landing_page_view",
  // Leads y mensajería — verificados a nivel de anuncio junto con los campos
  // de ranking de arriba (misma llamada, sin HTTP 400). actions_lead llega
  // null los días sin leads (se guarda 0, ver mapRow). La métrica de
  // mensajería cuenta conversaciones NUEVAS tras 7 días de inactividad.
  "actions_lead", "actions_onsite_conversion_messaging_conversation_started_7d",
  // Embudo de video (verificado 2026-10-15: se mezcla sin 400 con omni/ranking).
  "video_p25_watched_actions_video_view", "video_p50_watched_actions_video_view",
  "video_p75_watched_actions_video_view", "video_p100_watched_actions_video_view",
].join(",");

// Desgloses: Meta no permite mezclarlos entre sí ni con omni/ranking, así que
// cada uno es una llamada aparte, a nivel campaña y día, a su propia tabla.
const BREAKDOWN_METRICS = ["account_id", "date", "campaign_id", "spend", "impressions", "clicks", "reach",
  "actions_lead", "actions_onsite_conversion_messaging_conversation_started_7d"];
const BREAKDOWNS = [
  { mode: "plataforma", table: "meta_platform_daily", dims: ["publisher_platform", "platform_position"] },
  { mode: "demografia", table: "meta_demographics_daily", dims: ["age", "gender"] },
  { mode: "geo", table: "meta_geo_daily", dims: ["country", "region"] },
] as const;
const CREATIVE_FIELDS = ["account_id", "ad_id", "thumbnail_url", "image_url", "title", "body", "link_url"].join(",");

// Sondeo de cuentas dormidas: solo lo mínimo para saber si volvieron a tener actividad.
const PROBE_FIELDS = ["account_id", "date", "spend", "impressions"].join(",");

function buildWindsorUrl(
  apiKey: string,
  accountIds: string[],
  fields: string,
  range: Record<string, string>,
): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    fields,
    select_accounts: accountIds.join(","),
    ...range,
  });
  return `https://connectors.windsor.ai/facebook?${params.toString()}`;
}

function toDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// campaign_start_time / campaign_stop_time / adset_start_time / adset_end_time
// come back as UTC UNIX timestamps (seconds) per Windsor's field docs, but
// some connectors return them pre-formatted as date strings — handle both.
function toUnixDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string" && isNaN(Number(v))) return toDate(v);
  const seconds = Number(v);
  if (isNaN(seconds)) return null;
  const d = new Date(seconds * 1000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

// deno-lint-ignore no-explicit-any
type Supa = any;

interface Ctx {
  supabase: Supa;
  apiKey: string;
  runId: string;
  today: string; // YYYY-MM-DD en UTC
}

async function fetchWindsor(
  apiKey: string,
  accountIds: string[],
  fields: string,
  range: Record<string, string>,
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  const res = await fetch(buildWindsorUrl(apiKey, accountIds, fields, range));
  if (!res.ok) throw new Error(`Windsor fetch failed: ${res.status}`);
  const json = await res.json();
  return json?.data ?? [];
}

// deno-lint-ignore no-explicit-any
function mapRow(r: any) {
  const spend = toNum(r["spend"]);
  const clicks = toInt(r["clicks"]);
  const cpc = spend !== null && clicks && clicks > 0 ? spend / clicks : null;
  return {
    account_id: toStr(r["account_id"]),
    account_name: toStr(r["account_name"]),
    campaign_name: toStr(r["campaign"]),
    campaign_id: toStr(r["campaign_id"]),
    objective: toStr(r["campaign_objective"]),
    adset_name: toStr(r["adset_name"]),
    adset_id: toStr(r["adset_id"]),
    ad_id: toStr(r["ad_id"]),
    ad_name: toStr(r["ad_name"]),
    optimization_goal: toStr(r["adsset_optimization_goal"]),
    plataforma: "META",
    fecha: toDate(r["date"]),
    campaign_start_date: toUnixDate(r["campaign_start_time"]),
    campaign_end_date: toUnixDate(r["campaign_stop_time"]),
    adset_start_date: toUnixDate(r["adset_start_time"]),
    adset_end_date: toUnixDate(r["adset_end_time"]),
    campaign_lifetime_budget: toNum(r["campaign_lifetime_budget"]),
    daily_budget: toNum(r["campaign_daily_budget"]),
    budget_remaining: toNum(r["campaign_budget_remaining"]),
    adset_lifetime_budget: toNum(r["adset_lifetime_budget"]),
    adset_daily_budget: toNum(r["adset_daily_budget"]),
    adset_budget_remaining: toNum(r["adset_budget_remaining"]),
    total_cost: spend,
    cpc,
    cpm: toNum(r["cpm"]),
    frequency: toNum(r["frequency"]),
    ctr_all: toNum(r["ctr"]),
    clicks,
    reach: toInt(r["reach"]),
    impressions: toInt(r["impressions"]),
    thruplay_actions: toInt(r["video_thruplay_watched_actions_video_view"]),
    link_clicks: toInt(r["link_clicks"]),
    interactions: toInt(r["actions_post_engagement"]),
    conversions: toNum(r["conversions"]),
    purchases: toNum(r["actions_omni_purchase"]),
    add_to_cart: toNum(r["actions_omni_add_to_cart"]),
    initiate_checkout: toNum(r["actions_omni_initiated_checkout"]),
    purchase_value: toNum(r["action_values_omni_purchase"]),
    lead_value: toNum(r["action_values_lead"]),
    purchase_roas: toNum(r["purchase_roas_omni_purchase"]),
    website_purchase_roas: toNum(r["website_purchase_roas_offsite_conversion_fb_pixel_purchase"]),
    quality_ranking: toStr(r["quality_ranking"]),
    engagement_rate_ranking: toStr(r["engagement_rate_ranking"]),
    conversion_rate_ranking: toStr(r["conversion_rate_ranking"]),
    unique_clicks: toInt(r["unique_clicks"]),
    unique_ctr: toNum(r["unique_ctr"]),
    // publisher_platform intentionally not requested/mapped — see WINDSOR_FIELDS comment above.
    landing_page_views: toInt(r["actions_landing_page_view"]),
    // Desvío intencional del patrón toInt (que deja null): Windsor manda
    // null los días sin actividad, y aquí 0 es el valor correcto, no
    // "sin dato" — así se puede sumar sin filtrar nulls en cada consulta.
    leads: toInt(r["actions_lead"]) ?? 0,
    messaging_conversations: toInt(r["actions_onsite_conversion_messaging_conversation_started_7d"]) ?? 0,
    video_p25: toInt(r["video_p25_watched_actions_video_view"]),
    video_p50: toInt(r["video_p50_watched_actions_video_view"]),
    video_p75: toInt(r["video_p75_watched_actions_video_view"]),
    video_p100: toInt(r["video_p100_watched_actions_video_view"]),
  };
}

// Upsert por lotes sobre la llave natural (plataforma, account_id,
// campaign_id, adset_id, ad_id, fecha) — ver migración
// 20260817160100_meta_datos_multiplatform_upsert.sql. Reemplaza el
// patrón anterior de "borrar todo e insertar todo", que además de ser
// el P0 de CLAUDE.md era una bomba de tiempo multiplataforma: cada
// corrida de este sync borraba también las filas de cualquier otra
// plataforma (ej. un futuro sync-google-datos).
const NATURAL_KEY = "plataforma,account_id,campaign_id,adset_id,ad_id,fecha";
const BATCH = 500;

async function upsertRows(supabase: Supa, mapped: ReturnType<typeof mapRow>[]): Promise<number> {
  let upserted = 0;
  for (let i = 0; i < mapped.length; i += BATCH) {
    const chunk = mapped.slice(i, i + BATCH);
    const { error } = await supabase
      .from("meta_datos")
      .upsert(chunk, { onConflict: NATURAL_KEY });
    if (error) throw error;
    upserted += chunk.length;
  }
  return upserted;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e ?? "unknown");
}

interface RunLog {
  account_id: string;
  mode: "completo" | "sondeo" | "plataforma" | "demografia" | "geo" | "creativos";
  window_days: number | null;
  rows: number;
  status: "ok" | "error";
  error?: string | null;
  started_at: Date;
  finished_at: Date;
}

// Registrar la corrida es "best effort": si falla el log, el sync de datos sigue.
async function logRun(ctx: Ctx, e: RunLog): Promise<void> {
  const ms = e.finished_at.getTime() - e.started_at.getTime();
  console.log(JSON.stringify({
    run_id: ctx.runId, account_id: e.account_id, mode: e.mode,
    window_days: e.window_days, rows: e.rows, status: e.status, ms,
  }));
  try {
    const { error } = await ctx.supabase.from("sync_runs").insert({
      run_id: ctx.runId,
      account_id: e.account_id,
      mode: e.mode,
      window_days: e.window_days,
      rows: e.rows,
      status: e.status,
      error: e.error ?? null,
      started_at: e.started_at.toISOString(),
      finished_at: e.finished_at.toISOString(),
    });
    if (error) console.error("sync_runs: no se pudo registrar:", sanitizeError(error.message, [ctx.apiKey]));
  } catch (err) {
    console.error("sync_runs: no se pudo registrar:", sanitizeError(errMsg(err), [ctx.apiKey]));
  }
}

// Desgloses + creativos de UNA cuenta, tras su sync completo. Cada llamada es
// independiente: si una falla se registra y las demás siguen.
async function runExtras(ctx: Ctx, account: AdAccount, windowDays: number): Promise<void> {
  const range = windsorRangeParams(windowDays, ctx.today);
  for (const b of BREAKDOWNS) {
    const started = new Date();
    let n = 0;
    try {
      const rows = await fetchWindsor(ctx.apiKey, [account.account_id], [...BREAKDOWN_METRICS, ...b.dims].join(","), range);
      const agg = new Map<string, Record<string, unknown>>();
      for (const r of rows) {
        const fecha = toDate(r["date"]);
        if (!fecha) continue;
        const rec: Record<string, unknown> = {
          account_id: account.account_id, campaign_id: toStr(r["campaign_id"]) ?? "", fecha,
          [b.dims[0]]: toStr(r[b.dims[0]]) ?? "", [b.dims[1]]: toStr(r[b.dims[1]]) ?? "",
        };
        const key = [rec.campaign_id, fecha, rec[b.dims[0]], rec[b.dims[1]]].join("|");
        const cur = agg.get(key) ?? { ...rec, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, messaging_conversations: 0 };
        cur.spend = (cur.spend as number) + (toNum(r["spend"]) ?? 0);
        cur.impressions = (cur.impressions as number) + (toInt(r["impressions"]) ?? 0);
        cur.clicks = (cur.clicks as number) + (toInt(r["clicks"]) ?? 0);
        cur.reach = (cur.reach as number) + (toInt(r["reach"]) ?? 0);
        cur.leads = (cur.leads as number) + (toInt(r["actions_lead"]) ?? 0);
        cur.messaging_conversations = (cur.messaging_conversations as number) +
          (toInt(r["actions_onsite_conversion_messaging_conversation_started_7d"]) ?? 0);
        cur.synced_at = started.toISOString();
        agg.set(key, cur);
      }
      const list = [...agg.values()];
      const conflict = `account_id,campaign_id,fecha,${b.dims[0]},${b.dims[1]}`;
      for (let i = 0; i < list.length; i += BATCH) {
        const { error } = await ctx.supabase.from(b.table).upsert(list.slice(i, i + BATCH), { onConflict: conflict });
        if (error) throw error;
        n += Math.min(BATCH, list.length - i);
      }
      await logRun(ctx, { account_id: account.account_id, mode: b.mode, window_days: windowDays, rows: n,
        status: "ok", started_at: started, finished_at: new Date() });
    } catch (e) {
      await logRun(ctx, { account_id: account.account_id, mode: b.mode, window_days: windowDays, rows: n,
        status: "error", error: sanitizeError(errMsg(e), [ctx.apiKey]), started_at: started, finished_at: new Date() });
    }
  }
  // Creativos: un registro por anuncio (miniatura, título, texto).
  const started = new Date();
  let n = 0;
  try {
    const rows = await fetchWindsor(ctx.apiKey, [account.account_id], CREATIVE_FIELDS, range);
    const byAd = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      const ad = toStr(r["ad_id"]);
      if (!ad) continue;
      byAd.set(ad, {
        ad_id: ad, account_id: account.account_id,
        thumbnail_url: toStr(r["thumbnail_url"]), image_url: toStr(r["image_url"]),
        title: toStr(r["title"]), body: toStr(r["body"]), link_url: toStr(r["link_url"]),
        updated_at: started.toISOString(),
      });
    }
    const list = [...byAd.values()];
    for (let i = 0; i < list.length; i += BATCH) {
      const { error } = await ctx.supabase.from("meta_ad_creatives").upsert(list.slice(i, i + BATCH), { onConflict: "ad_id" });
      if (error) throw error;
      n += Math.min(BATCH, list.length - i);
    }
    await logRun(ctx, { account_id: account.account_id, mode: "creativos", window_days: windowDays, rows: n,
      status: "ok", started_at: started, finished_at: new Date() });
  } catch (e) {
    await logRun(ctx, { account_id: account.account_id, mode: "creativos", window_days: windowDays, rows: n,
      status: "error", error: sanitizeError(errMsg(e), [ctx.apiKey]), started_at: started, finished_at: new Date() });
  }
}

// Sync completo (nivel anuncio) de UNA cuenta. Devuelve true si salió bien.
async function runFullSync(ctx: Ctx, account: AdAccount, windowDays: number): Promise<boolean> {
  const started = new Date();
  let rowsWritten = 0;
  try {
    const rows = await fetchWindsor(
      ctx.apiKey,
      [account.account_id],
      WINDSOR_FIELDS,
      windsorRangeParams(windowDays, ctx.today),
    );
    const mapped = rows.map(mapRow);
    rowsWritten = await upsertRows(ctx.supabase, mapped);

    // last_data_date = fecha más reciente con spend>0 o impresiones>0 (nunca retrocede).
    // last_synced_at, en cambio, se actualiza en TODA corrida exitosa (haya
    // habido actividad o no) — es lo que las tarjetas de Clientes muestran
    // como "Actualizado hace X h", y last_data_date no sirve para eso porque
    // no avanza en una corrida sin gasto/impresiones.
    const latest = latestActivityDate(
      mapped.map((m) => ({ date: m.fecha, spend: m.total_cost, impressions: m.impressions })),
    );
    const newLast = maxDate(account.last_data_date, latest);
    const patch: Record<string, string> = { last_synced_at: started.toISOString() };
    if (newLast && newLast !== account.last_data_date) patch.last_data_date = newLast;
    const { error } = await ctx.supabase
      .from("ad_accounts")
      .update(patch)
      .eq("account_id", account.account_id);
    if (error) throw error;
    if (patch.last_data_date) account.last_data_date = newLast!;

    await logRun(ctx, {
      account_id: account.account_id, mode: "completo", window_days: windowDays,
      rows: rowsWritten, status: "ok", started_at: started, finished_at: new Date(),
    });
    await runExtras(ctx, account, windowDays);
    return true;
  } catch (e) {
    await logRun(ctx, {
      account_id: account.account_id, mode: "completo", window_days: windowDays,
      rows: rowsWritten, status: "error", error: sanitizeError(errMsg(e), [ctx.apiKey]),
      started_at: started, finished_at: new Date(),
    });
    return false;
  }
}

// Sondeo de TODAS las cuentas dormidas en UNA sola llamada a Windsor (últimos 7 días,
// solo account_id/date/spend/impressions). Devuelve las que mostraron actividad.
async function runProbe(
  ctx: Ctx,
  dormant: AdAccount[],
): Promise<{ errors: number; awake: AdAccount[] }> {
  const started = new Date();
  const ids = dormant.map((a) => a.account_id);
  const PROBE_DAYS = 7;

  let summary: Map<string, ProbeSummary>;
  try {
    const rows = await fetchWindsor(ctx.apiKey, ids, PROBE_FIELDS, { date_preset: "last_7d" });
    summary = summarizeProbe(rows, ids);
  } catch (e) {
    // El sondeo no ocurrió: no se toca last_probe_at; se registra el error por cada cuenta.
    const finished = new Date();
    const msg = sanitizeError(errMsg(e), [ctx.apiKey]);
    for (const a of dormant) {
      await logRun(ctx, {
        account_id: a.account_id, mode: "sondeo", window_days: PROBE_DAYS, rows: 0,
        status: "error", error: msg, started_at: started, finished_at: finished,
      });
    }
    return { errors: dormant.length, awake: [] };
  }

  const probedAt = new Date();
  const awake: AdAccount[] = [];
  let errors = 0;
  for (const a of dormant) {
    const s = summary.get(a.account_id)!;
    try {
      const newLast = maxDate(a.last_data_date, s.latestActivityDate);
      const patch: Record<string, string | null> = { last_probe_at: probedAt.toISOString() };
      if (s.latestActivityDate && newLast) patch.last_data_date = newLast;
      const { error } = await ctx.supabase
        .from("ad_accounts")
        .update(patch)
        .eq("account_id", a.account_id);
      if (error) throw error;

      await logRun(ctx, {
        account_id: a.account_id, mode: "sondeo", window_days: PROBE_DAYS, rows: s.rows,
        status: "ok", started_at: started, finished_at: probedAt,
      });
      if (s.latestActivityDate) awake.push({ ...a, last_data_date: newLast });
    } catch (e) {
      errors++;
      await logRun(ctx, {
        account_id: a.account_id, mode: "sondeo", window_days: PROBE_DAYS, rows: s.rows,
        status: "error", error: sanitizeError(errMsg(e), [ctx.apiKey]),
        started_at: started, finished_at: new Date(),
      });
    }
  }
  return { errors, awake };
}

// Trabajo de sync (se ejecuta en segundo plano tras validar secreto y candado).
// overrideWindowDays: fuerza esa ventana para las cuentas en plan.full (las
// "con datos"; dormidas/omitidas no se tocan) — uso manual, una vez, para
// rellenar historial de columnas nuevas (ver CLAUDE.md / backfill de leads).
// accountIds: si viene, acota el sync a esas cuentas nada más — un backfill
// de 35 días de las 4 cuentas activas juntas podría pasar el límite de
// tiempo de la función (la diaria de 7 días ya tarda ~2.5 min; Kemmerling
// sola, ~94 s con 7 días), así que el backfill se corre una cuenta a la vez.
async function doSync(runId: string, overrideWindowDays?: number, accountIds?: string[]): Promise<Response> {
  const startedMs = Date.now();
  const windsorApiKey = Deno.env.get("WINDSOR_API_KEY") ?? "";
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!windsorApiKey) {
      throw new Error("WINDSOR_API_KEY is not configured (set it with `supabase secrets set`)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ctx: Ctx = { supabase, apiKey: windsorApiKey, runId, today: toIsoDate(new Date()) };

    // 1) Cuentas desde ad_accounts (ya no hay una cuenta hardcodeada).
    const { data: accountRows, error: accErr } = await supabase
      .from("ad_accounts")
      .select("account_id,account_name,platform,active,sync_mode,last_data_date,last_probe_at")
      .eq("platform", "facebook");
    if (accErr) throw accErr;
    const accounts = (accountRows ?? []) as AdAccount[];

    // 2) ¿Qué cuentas ya tuvieron un sync completo exitoso? Una consulta por cuenta
    //    (evita el límite de 1000 filas de PostgREST cuando sync_runs crezca).
    const eligible = accounts.filter((a) => a.active && a.sync_mode !== "never");
    const firstSyncDone = new Set<string>();
    await Promise.all(eligible.map(async (a) => {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("account_id", a.account_id)
        .eq("mode", "completo")
        .eq("status", "ok")
        .limit(1);
      if (error) throw error; // sin sync_runs no hay forma de saber si es la primera vez
      if (data && data.length > 0) firstSyncDone.add(a.account_id);
    }));

    // 3) Aplicar la regla por cuenta.
    let plan = classifyAccounts(accounts, ctx.today, firstSyncDone);
    if (accountIds && accountIds.length > 0) {
      const wanted = new Set(accountIds);
      plan = {
        full: plan.full.filter((item) => wanted.has(item.account.account_id)),
        dormant: plan.dormant.filter((a) => wanted.has(a.account_id)),
        skipped: plan.skipped,
      };
    }
    let fullSynced = 0;
    let woken = 0;
    let errors = 0;

    // 3a) Sync completo de las cuentas con datos recientes (una llamada por cuenta:
    //     un fallo no tumba a las demás y el conteo de filas queda por cuenta).
    for (const item of plan.full) {
      const windowDays = overrideWindowDays ?? item.windowDays;
      if (await runFullSync(ctx, { ...item.account }, windowDays)) fullSynced++;
      else errors++;
    }

    // 3b) Sondeo único de las dormidas; las que despiertan hacen backfill de 35 días.
    if (plan.dormant.length > 0) {
      const probe = await runProbe(ctx, plan.dormant);
      errors += probe.errors;
      for (const acc of probe.awake) {
        woken++;
        if (await runFullSync(ctx, acc, BACKFILL_WINDOW_DAYS)) fullSynced++;
        else errors++;
      }
    }

    const durationMs = Date.now() - startedMs;
    console.log(JSON.stringify({
      run_id: runId, full_synced: fullSynced, probed: plan.dormant.length, woken,
      skipped: plan.skipped.length, errors, duration_ms: durationMs,
    }));

    // Respuesta mínima a propósito: solo conteos. La función es pública
    // (verify_jwt=false); el detalle por cuenta vive en sync_runs (solo admin).
    return json({
      success: errors === 0,
      run_id: runId,
      full_synced: fullSynced,
      probed: plan.dormant.length,
      woken,
      skipped: plan.skipped.length,
      errors,
      duration_ms: durationMs,
    }, errors === 0 ? 200 : 500);
  } catch (e) {
    console.error("sync-meta-datos error:", sanitizeError(errMsg(e), [windsorApiKey]));
    return json({ success: false, run_id: runId, error: "sync_failed" }, 500);
  }
}

const LOCK_NAME = "sync-meta-datos";
const LOCK_TTL_SECONDS = 900; // si la función muere, el candado vence solo a los 15 min

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // 1) Secreto compartido: sin header correcto, 401 y no se ejecuta nada.
  const expected = Deno.env.get("SYNC_CRON_SECRET") ?? "";
  const provided = req.headers.get("x-sync-secret") ?? "";
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }

  // backfill_days opcional en el body (mismo secreto de arriba): fuerza esa
  // ventana en vez de la que tocaría por regla (7 días el día a día). Uso
  // manual, puntual — tope de seguridad para no pedirle a Windsor un rango
  // absurdo por error de tipeo. account_ids (opcional): acota el backfill a
  // esas cuentas nada más, para correrlo una cuenta a la vez (ver doSync).
  const MAX_BACKFILL_DAYS = 90;
  let overrideWindowDays: number | undefined;
  let accountIds: string[] | undefined;
  try {
    const body = await req.json();
    const requested = Number(body?.backfill_days);
    if (Number.isFinite(requested) && requested > 0) {
      overrideWindowDays = Math.min(Math.trunc(requested), MAX_BACKFILL_DAYS);
    }
    if (Array.isArray(body?.account_ids) && body.account_ids.length > 0) {
      accountIds = body.account_ids.filter((id: unknown) => typeof id === "string");
    }
  } catch {
    // Sin body (la corrida diaria del cron no manda uno) — sigue sin override.
  }

  // 2) Candado en la base: si hay otra corrida viva, no se arranca otra.
  const runId = crypto.randomUUID();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: got, error: lockErr } = await admin.rpc("try_acquire_sync_lock", {
    _name: LOCK_NAME, _holder: runId, _ttl_seconds: LOCK_TTL_SECONDS,
  });
  if (lockErr) {
    console.error("lock error:", lockErr.message);
    return json({ error: "lock_failed" }, 500);
  }
  if (!got) return json({ error: "already_running" }, 409);

  // 3) Responder ya (202) y sincronizar en segundo plano; el candado se libera al terminar.
  const work = (async () => {
    try {
      await doSync(runId, overrideWindowDays, accountIds);
    } finally {
      await admin.rpc("release_sync_lock", { _name: LOCK_NAME, _holder: runId });
    }
  })();
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(work);
  return json({ accepted: true, run_id: runId }, 202);
});
