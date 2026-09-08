import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
].join(",");
const WINDSOR_ACCOUNTS = "204109401";

function buildWindsorUrl(apiKey: string): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    date_preset: "last_30d",
    fields: WINDSOR_FIELDS,
    select_accounts: WINDSOR_ACCOUNTS,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const windsorApiKey = Deno.env.get("WINDSOR_API_KEY");
    if (!windsorApiKey) {
      throw new Error("WINDSOR_API_KEY is not configured (set it with `supabase secrets set`)");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const res = await fetch(buildWindsorUrl(windsorApiKey));
    if (!res.ok) throw new Error(`Windsor fetch failed: ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.data ?? [];

    const mapped = rows.map((r) => {
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
      };
    });

    // Upsert por lotes sobre la llave natural (plataforma, account_id,
    // campaign_id, adset_id, ad_id, fecha) — ver migración
    // 20260817160100_meta_datos_multiplatform_upsert.sql. Reemplaza el
    // patrón anterior de "borrar todo e insertar todo", que además de ser
    // el P0 de CLAUDE.md era una bomba de tiempo multiplataforma: cada
    // corrida de este sync borraba también las filas de cualquier otra
    // plataforma (ej. un futuro sync-google-datos).
    const NATURAL_KEY = "plataforma,account_id,campaign_id,adset_id,ad_id,fecha";
    const BATCH = 500;
    let upserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const chunk = mapped.slice(i, i + BATCH);
      const { error } = await supabase
        .from("meta_datos")
        .upsert(chunk, { onConflict: NATURAL_KEY });
      if (error) throw error;
      upserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ success: true, inserted: upserted, total: mapped.length, source: "windsor" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("sync-meta-datos error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
