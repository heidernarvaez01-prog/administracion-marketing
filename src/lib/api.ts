import { supabase } from "@/integrations/supabase/client";

export interface ApiCampaignRow {
  account_id: string;
  account_name: string;
  campaign_name: string;
  adset_name: string;
  platform: string;
  date: string;
  /** Ad-level identity — populated once Windsor sends ad_id/ad_name (see sync-meta-datos). */
  adId: string | null;
  adName: string | null;
  /** Placement this row's spend ran on (Facebook Feed, Instagram, Audience Network, ...). */
  publisherPlatform: string | null;
  /** Meta's own ad-quality diagnostics — categorical, e.g. "ABOVE_AVERAGE" / "BELOW_AVERAGE_20". */
  qualityRanking: string | null;
  engagementRanking: string | null;
  conversionRanking: string | null;
  metrics: {
    cost: number;
    clicks: number;
    impressions: number;
    reach: number;
    cpc: number;
    cpm: number;
    ctr: number;
    frequency: number;
    thruplay_actions: number;
    link_clicks: number;
    interactions: number;
    conversions: number;
    /** Meta's currently active daily budget for this campaign (null if unset). */
    dailyBudget: number | null;
    /** Funnel steps between a click and a completed purchase. */
    landingPageViews: number;
    addToCart: number;
    initiateCheckout: number;
    purchases: number;
    purchaseValue: number;
    purchaseRoas: number | null;
  };
}

let cache: { data: ApiCampaignRow[]; ts: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export function clearCampaignDataCache() {
  cache = null;
}

const FULL_COLUMNS =
  "account_id,account_name,campaign_name,adset_name,plataforma,fecha,total_cost,clicks,impressions,reach,cpc,cpm,ctr_all,frequency,thruplay_actions,link_clicks,interactions,conversions,daily_budget," +
  "ad_id,ad_name,publisher_platform,quality_ranking,engagement_rate_ranking,conversion_rate_ranking," +
  "landing_page_views,add_to_cart,initiate_checkout,purchases,purchase_value,purchase_roas";
// Fallback while the DB migration adding link_clicks/interactions/conversions is pending
const LEGACY_COLUMNS =
  "account_id,account_name,campaign_name,adset_name,plataforma,fecha,total_cost,clicks,impressions,reach,cpc,cpm,ctr_all,frequency,thruplay_actions";

export async function fetchCampaignData(): Promise<ApiCampaignRow[]> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.data;

  const all: ApiCampaignRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let columns = FULL_COLUMNS;

  while (true) {
    let { data, error } = await supabase
      .from("meta_datos")
      .select(columns)
      .order("fecha", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error && columns === FULL_COLUMNS && error.code === "42703") {
      columns = LEGACY_COLUMNS;
      ({ data, error } = await supabase
        .from("meta_datos")
        .select(columns)
        .order("fecha", { ascending: true })
        .range(from, from + PAGE - 1));
    }

    if (error) {
      console.error("fetchCampaignData error:", error);
      break;
    }
    if (!data || data.length === 0) break;

    for (const r of data as any[]) {
      all.push({
        account_id: String(r.account_id ?? ""),
        account_name: String(r.account_name ?? ""),
        campaign_name: String(r.campaign_name ?? ""),
        adset_name: String(r.adset_name ?? ""),
        platform: String(r.plataforma ?? "META"),
        date: String(r.fecha ?? "").slice(0, 10),
        adId: (r as any).ad_id ?? null,
        adName: (r as any).ad_name ?? null,
        publisherPlatform: (r as any).publisher_platform ?? null,
        qualityRanking: (r as any).quality_ranking ?? null,
        engagementRanking: (r as any).engagement_rate_ranking ?? null,
        conversionRanking: (r as any).conversion_rate_ranking ?? null,
        metrics: {
          cost: Number(r.total_cost ?? 0),
          clicks: Number(r.clicks ?? 0),
          impressions: Number(r.impressions ?? 0),
          reach: Number(r.reach ?? 0),
          cpc: Number(r.cpc ?? 0),
          cpm: Number(r.cpm ?? 0),
          ctr: Number(r.ctr_all ?? 0),
          frequency: Number(r.frequency ?? 0),
          thruplay_actions: Number(r.thruplay_actions ?? 0),
          link_clicks: Number((r as any).link_clicks ?? 0),
          interactions: Number((r as any).interactions ?? 0),
          conversions: Number((r as any).conversions ?? 0),
          dailyBudget: (r as any).daily_budget != null ? Number((r as any).daily_budget) : null,
          landingPageViews: Number((r as any).landing_page_views ?? 0),
          addToCart: Number((r as any).add_to_cart ?? 0),
          initiateCheckout: Number((r as any).initiate_checkout ?? 0),
          purchases: Number((r as any).purchases ?? 0),
          purchaseValue: Number((r as any).purchase_value ?? 0),
          purchaseRoas: (r as any).purchase_roas != null ? Number((r as any).purchase_roas) : null,
        },
      });
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  cache = { data: all, ts: Date.now() };
  return all;
}

export function getUniqueCampaignNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.campaign_name).filter(Boolean))].sort();
}

export function getUniqueAccountIds(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.account_id).filter(Boolean))].sort();
}

export function getUniquePlatforms(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.platform).filter(Boolean))].sort();
}

export function getUniqueAccountNames(data: ApiCampaignRow[]): string[] {
  return [...new Set(data.map((r) => r.account_name).filter(Boolean))].sort();
}

export function getCampaignCost(
  data: ApiCampaignRow[],
  campaignName: string,
  startDate: string,
  endDate: string
): number {
  return data
    .filter(
      (r) =>
        r.campaign_name === campaignName &&
        r.date >= startDate &&
        r.date <= endDate
    )
    .reduce((sum, r) => sum + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
}
