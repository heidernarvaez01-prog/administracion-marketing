// Canonical metrics layer — pure TS, no React/DOM/Deno/Node/Supabase APIs.
// Single source of truth for "how do we compute CTR/CPC/CPM/ROAS and how do
// we aggregate meta_datos rows" so the Vite frontend (src/lib/metrics.ts
// re-exports this, same pattern as _shared/alert-engine.ts) and every Edge
// Function that touches campaign metrics (alert-dispatch, metrics-ai-analysis,
// future AI tools) compute the exact same numbers from the exact same rows.
// Do not duplicate this math elsewhere — extend this file instead.
//
// MetricsRow is intentionally shaped like src/lib/api.ts's ApiCampaignRow
// (same field names) so an ApiCampaignRow[] satisfies it structurally with
// zero mapping on the frontend. Server-side callers get MetricsRow[] from
// _shared/meta-datos-query.ts, which owns the raw-DB-row → MetricsRow
// mapping (the only place that talks to Supabase for this data).

export interface MetricsRow {
  campaign_name: string;
  platform: string;
  account_id?: string | null;
  account_name?: string | null;
  date: string; // YYYY-MM-DD
  objective?: string | null;
  adId?: string | null;
  adName?: string | null;
  publisherPlatform?: string | null;
  qualityRanking?: string | null;
  engagementRanking?: string | null;
  conversionRanking?: string | null;
  metrics: {
    cost: number;
    clicks: number;
    impressions: number;
    reach?: number;
    frequency?: number | null;
    dailyBudget?: number | null;
    landingPageViews?: number;
    addToCart?: number;
    initiateCheckout?: number;
    purchases?: number;
    purchaseValue?: number;
  };
}

// ── Derived-metric formulas — one implementation, every caller ─────────────
// CTR/CPC/CPM follow the codebase's dominant convention (0 when the
// denominator is 0, not null) — matches AuditDetailPage, PerformanceCharts
// and alert-engine.ts's own inline versions of this math. ROAS is the one
// exception: null (not 0) when there's no cost, so "no data" and "genuinely
// zero return" stay distinguishable in the UI ("—" vs "0.00x").

export function computeCtr(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}
export function computeCpc(cost: number, clicks: number): number {
  return clicks > 0 ? cost / clicks : 0;
}
export function computeCpm(cost: number, impressions: number): number {
  return impressions > 0 ? (cost / impressions) * 1000 : 0;
}
export function computeRoas(cost: number, purchaseValue: number): number | null {
  return cost > 0 ? purchaseValue / cost : null;
}
// Percent change, prior === 0 collapses to 0 (matches the historical inline
// version in _shared/ai-insights.ts — avoids a divide-by-zero producing
// Infinity/NaN in a deviation percentage).
export function pctChange(recent: number, prior: number): number {
  return prior !== 0 ? ((recent - prior) / Math.abs(prior)) * 100 : 0;
}

// Meta's ranking values look like "ABOVE_AVERAGE", "AVERAGE",
// "BELOW_AVERAGE_10/20/35/50", or "UNKNOWN" — collapse to 3 buckets.
export type RankingBucket = 'above' | 'average' | 'below' | 'unknown';
export function bucketRanking(v: string | null | undefined): RankingBucket {
  if (!v || v === 'UNKNOWN') return 'unknown';
  if (v.startsWith('ABOVE')) return 'above';
  if (v.startsWith('BELOW')) return 'below';
  return 'average';
}

// ── Aggregation over already-fetched rows (no Supabase dependency here —
// callers fetch/filter first, same division of labor as alert-engine.ts) ──

export interface AggregateTotals {
  cost: number;
  clicks: number;
  impressions: number;
  reach: number;
  purchaseValue: number;
  purchases: number;
  addToCart: number;
  initiateCheckout: number;
  landingPageViews: number;
  frequencySum: number;
  frequencyDays: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number | null;
  avgFrequency: number | null;
}

export function aggregateTotals(rows: MetricsRow[]): AggregateTotals {
  let cost = 0, clicks = 0, impressions = 0, reach = 0, purchaseValue = 0, purchases = 0;
  let addToCart = 0, initiateCheckout = 0, landingPageViews = 0, frequencySum = 0, frequencyDays = 0;
  for (const r of rows) {
    const m = r.metrics;
    cost += m.cost || 0;
    clicks += m.clicks || 0;
    impressions += m.impressions || 0;
    reach += m.reach || 0;
    purchaseValue += m.purchaseValue || 0;
    purchases += m.purchases || 0;
    addToCart += m.addToCart || 0;
    initiateCheckout += m.initiateCheckout || 0;
    landingPageViews += m.landingPageViews || 0;
    if (m.frequency != null) {
      frequencySum += m.frequency;
      frequencyDays++;
    }
  }
  return {
    cost, clicks, impressions, reach, purchaseValue, purchases, addToCart, initiateCheckout, landingPageViews,
    frequencySum, frequencyDays,
    cpc: computeCpc(cost, clicks),
    cpm: computeCpm(cost, impressions),
    ctr: computeCtr(clicks, impressions),
    roas: computeRoas(cost, purchaseValue),
    avgFrequency: frequencyDays > 0 ? frequencySum / frequencyDays : null,
  };
}

export interface CampaignTotals extends AggregateTotals {
  campaign: string;
}
// One row set → one totals object per campaign_name, sorted by spend desc.
export function getSpendByCampaign(rows: MetricsRow[]): CampaignTotals[] {
  const byCampaign = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    const key = r.campaign_name || 'Sin nombre';
    if (!byCampaign.has(key)) byCampaign.set(key, []);
    byCampaign.get(key)!.push(r);
  }
  return Array.from(byCampaign.entries())
    .map(([campaign, campaignRows]) => ({ campaign, ...aggregateTotals(campaignRows) }))
    .sort((a, b) => b.cost - a.cost);
}

export interface PlatformTotals extends AggregateTotals {
  platform: string;
}
export function getSpendByPlatform(rows: MetricsRow[]): PlatformTotals[] {
  const byPlatform = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    const key = r.platform || 'Desconocida';
    if (!byPlatform.has(key)) byPlatform.set(key, []);
    byPlatform.get(key)!.push(r);
  }
  return Array.from(byPlatform.entries())
    .map(([platform, platformRows]) => ({ platform, ...aggregateTotals(platformRows) }))
    .sort((a, b) => b.cost - a.cost);
}

export type TopCampaignMetric = 'cost' | 'clicks' | 'impressions' | 'purchaseValue' | 'roas' | 'ctr';
export function getTopCampaigns(rows: MetricsRow[], metric: TopCampaignMetric = 'cost', limit = 10): CampaignTotals[] {
  const all = getSpendByCampaign(rows);
  return [...all]
    .sort((a, b) => (Number(b[metric] ?? -Infinity)) - (Number(a[metric] ?? -Infinity)))
    .slice(0, limit);
}

// Spend/CTR split by placement (Facebook Feed, Instagram, Audience
// Network, ...) — which of Meta's delivery surfaces is actually working.
export interface PlacementBreakdown {
  name: string;
  cost: number;
  clicks: number;
  impressions: number;
  ctr: number;
}
export function getPlacementBreakdown(rows: MetricsRow[]): PlacementBreakdown[] {
  const byPlacement = new Map<string, { cost: number; clicks: number; impressions: number }>();
  for (const r of rows) {
    const key = r.publisherPlatform || 'Desconocido';
    const acc = byPlacement.get(key) ?? { cost: 0, clicks: 0, impressions: 0 };
    acc.cost += r.metrics.cost;
    acc.clicks += r.metrics.clicks;
    acc.impressions += r.metrics.impressions;
    byPlacement.set(key, acc);
  }
  return Array.from(byPlacement.entries())
    .map(([name, v]) => ({ name, ...v, ctr: computeCtr(v.clicks, v.impressions) }))
    .sort((a, b) => b.cost - a.cost);
}

// Ad-level leaderboard — which individual creative to keep/rotate, not just
// "the campaign" in aggregate. Rows without ad_id (older syncs) are grouped
// under "Unknown ad".
export interface AdLeaderboardEntry {
  name: string;
  cost: number;
  clicks: number;
  impressions: number;
  purchaseValue: number;
  quality: string | null;
  ctr: number;
  roas: number | null;
}
export function getAdLeaderboard(rows: MetricsRow[], limit = 10): AdLeaderboardEntry[] {
  const byAd = new Map<string, { name: string; cost: number; clicks: number; impressions: number; purchaseValue: number; quality: string | null }>();
  for (const r of rows) {
    const key = r.adId || r.adName || 'unknown';
    const acc = byAd.get(key) ?? { name: r.adName || 'Anuncio desconocido', cost: 0, clicks: 0, impressions: 0, purchaseValue: 0, quality: null };
    acc.cost += r.metrics.cost;
    acc.clicks += r.metrics.clicks;
    acc.impressions += r.metrics.impressions;
    acc.purchaseValue += r.metrics.purchaseValue ?? 0;
    if (r.qualityRanking) acc.quality = r.qualityRanking;
    byAd.set(key, acc);
  }
  return Array.from(byAd.values())
    .map(a => ({ ...a, ctr: computeCtr(a.clicks, a.impressions), roas: computeRoas(a.cost, a.purchaseValue) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
}

// Meta's own 3 quality diagnostics, read from the most recently dated row.
export interface RankingSummary {
  quality: string | null;
  engagement: string | null;
  conversion: string | null;
}
export function getRankingSummary(rows: MetricsRow[]): RankingSummary {
  const latest = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return {
    quality: latest?.qualityRanking ?? null,
    engagement: latest?.engagementRanking ?? null,
    conversion: latest?.conversionRanking ?? null,
  };
}

// Funnel: where the drop-off actually happens between an impression and a
// completed purchase — the diagnosis a flat CTR/ROAS number can't give.
export function getFunnelBreakdown(rows: MetricsRow[]): Array<{ label: string; value: number }> {
  const t = aggregateTotals(rows);
  return [
    { label: 'Impresiones', value: t.impressions },
    { label: 'Clics', value: t.clicks },
    { label: 'Vistas de landing page', value: t.landingPageViews },
    { label: 'Agregar al carrito', value: t.addToCart },
    { label: 'Checkout iniciado', value: t.initiateCheckout },
    { label: 'Compras', value: t.purchases },
  ];
}

// Day-by-day series for trend charts. Presentation-agnostic: callers format
// dates/labels themselves (PerformanceCharts.tsx formats to "DD Mon" and
// renames cost→spend for the chart legend).
export interface TimeSeriesPoint {
  date: string;
  cost: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
}
export function getTimeSeries(rows: MetricsRow[]): TimeSeriesPoint[] {
  const byDate = new Map<string, MetricsRow[]>();
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => {
      const t = aggregateTotals(dayRows);
      return {
        date,
        cost: +t.cost.toFixed(2),
        clicks: t.clicks,
        impressions: t.impressions,
        reach: t.reach,
        ctr: +t.ctr.toFixed(2),
        cpc: +t.cpc.toFixed(2),
        cpm: +t.cpm.toFixed(2),
      };
    });
}

// Two already-filtered row sets (e.g. "first half of July" vs "second half
// of June") → totals for each + percent change. Built for Fase 4's
// compare_periods AI tool, also usable directly by any UI that needs a
// period-over-period delta.
export interface PeriodComparison {
  current: AggregateTotals;
  previous: AggregateTotals;
  deltaPct: {
    cost: number;
    clicks: number;
    impressions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas: number | null;
  };
}
export function compareToPreviousPeriod(currentRows: MetricsRow[], previousRows: MetricsRow[]): PeriodComparison {
  const current = aggregateTotals(currentRows);
  const previous = aggregateTotals(previousRows);
  return {
    current,
    previous,
    deltaPct: {
      cost: pctChange(current.cost, previous.cost),
      clicks: pctChange(current.clicks, previous.clicks),
      impressions: pctChange(current.impressions, previous.impressions),
      ctr: pctChange(current.ctr, previous.ctr),
      cpc: pctChange(current.cpc, previous.cpc),
      cpm: pctChange(current.cpm, previous.cpm),
      roas: current.roas != null && previous.roas != null ? pctChange(current.roas, previous.roas) : null,
    },
  };
}
