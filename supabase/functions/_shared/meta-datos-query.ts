// The only place that talks to Supabase for meta_datos. Every Edge Function
// that needs campaign metrics (alert-dispatch, metrics-ai-analysis, future
// AI tools) should call queryMetaDatos() instead of writing its own
// `.from('meta_datos').select(...)` — that's how a second `select("*")`
// with no filter (unbounded, and about to include every future platform's
// rows too) doesn't creep back in once there's more than one platform.
//
// Row-mapping duplicates src/lib/api.ts's fetchCampaignData() by necessity,
// not carelessness: this runs in Deno (npm: specifier imports) and api.ts
// runs in the Vite frontend (bare specifiers + the browser Supabase client)
// — the two module systems aren't cross-importable, same reason
// _shared/audit-calculations.ts duplicates src/lib/audit-calculations.ts.
// Keep the two mappings in sync if meta_datos gains/renames a column.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.0';
import type { MetricsRow } from './metrics.ts';

export interface MetaDatosFilters {
  platforms?: string[];
  accountIds?: string[];
  campaignNames?: string[];
  /** Inclusive, YYYY-MM-DD. */
  dateFrom?: string;
  /** Inclusive, YYYY-MM-DD. */
  dateTo?: string;
  /**
   * Row cap for callers that explicitly want a bounded sample (e.g. a quick
   * "most recent N rows" tool call). Omit for a full, paginated fetch —
   * the default, and what every current caller needs.
   */
  limit?: number;
}

// clientId isn't a meta_datos column — resolving "this client's campaigns"
// requires audit_records, scoped by the caller's own userId (the same
// security-sensitive join alert-dispatch and metrics-ai-analysis already do
// inline). That resolution stays with the caller; pass the resulting
// campaign names in via `campaignNames` here.
const PAGE = 1000;

function mapRow(r: Record<string, any>): MetricsRow {
  return {
    campaign_name: String(r.campaign_name ?? ''),
    platform: String(r.plataforma ?? 'META'),
    account_id: r.account_id ?? null,
    account_name: r.account_name ?? null,
    date: String(r.fecha ?? '').slice(0, 10),
    objective: r.objective ?? null,
    adId: r.ad_id ?? null,
    adName: r.ad_name ?? null,
    publisherPlatform: r.publisher_platform ?? null,
    qualityRanking: r.quality_ranking ?? null,
    engagementRanking: r.engagement_rate_ranking ?? null,
    conversionRanking: r.conversion_rate_ranking ?? null,
    metrics: {
      cost: Number(r.total_cost ?? 0),
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      reach: Number(r.reach ?? 0),
      frequency: r.frequency != null ? Number(r.frequency) : null,
      dailyBudget: r.daily_budget != null ? Number(r.daily_budget) : null,
      landingPageViews: Number(r.landing_page_views ?? 0),
      addToCart: Number(r.add_to_cart ?? 0),
      initiateCheckout: Number(r.initiate_checkout ?? 0),
      purchases: Number(r.purchases ?? 0),
      purchaseValue: Number(r.purchase_value ?? 0),
    },
  };
}

const COLUMNS =
  'campaign_name,plataforma,account_id,account_name,fecha,objective,ad_id,ad_name,publisher_platform,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,' +
  'total_cost,clicks,impressions,reach,frequency,daily_budget,landing_page_views,add_to_cart,initiate_checkout,purchases,purchase_value';

export async function queryMetaDatos(
  supabase: SupabaseClient,
  filters: MetaDatosFilters = {},
): Promise<MetricsRow[]> {
  const { platforms, accountIds, campaignNames, dateFrom, dateTo, limit } = filters;

  const applyFilters = (q: any) => {
    if (platforms?.length) q = q.in('plataforma', platforms);
    if (accountIds?.length) q = q.in('account_id', accountIds);
    if (campaignNames?.length) q = q.in('campaign_name', campaignNames);
    if (dateFrom) q = q.gte('fecha', dateFrom);
    if (dateTo) q = q.lte('fecha', dateTo);
    return q;
  };

  // Bounded fetch: one query, most recent rows first — for callers that
  // explicitly asked for a capped sample instead of the full range.
  if (limit != null) {
    const { data, error } = await applyFilters(
      supabase.from('meta_datos').select(COLUMNS).order('fecha', { ascending: false }).limit(limit),
    );
    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  // Unbounded fetch: paginate through everything matching the filters.
  const all: MetricsRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await applyFilters(
      supabase.from('meta_datos').select(COLUMNS).order('fecha', { ascending: true }),
    ).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) all.push(mapRow(r));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
