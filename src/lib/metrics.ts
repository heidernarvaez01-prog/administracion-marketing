// The metrics/aggregation layer lives in one canonical, runtime-agnostic
// module so the frontend and Edge Functions (alert-dispatch, ai-insights,
// metrics-ai-analysis) can never compute CTR/CPC/CPM/ROAS/aggregates
// differently. See supabase/functions/_shared/metrics.ts.
export {
  computeCtr,
  computeCpc,
  computeCpm,
  computeRoas,
  pctChange,
  bucketRanking,
  aggregateTotals,
  getSpendByCampaign,
  getSpendByPlatform,
  getTopCampaigns,
  getPlacementBreakdown,
  getAdLeaderboard,
  getRankingSummary,
  getFunnelBreakdown,
  getTimeSeries,
  compareToPreviousPeriod,
} from '../../supabase/functions/_shared/metrics';
export type {
  MetricsRow,
  RankingBucket,
  AggregateTotals,
  CampaignTotals,
  PlatformTotals,
  TopCampaignMetric,
  PlacementBreakdown,
  AdLeaderboardEntry,
  RankingSummary,
  TimeSeriesPoint,
  PeriodComparison,
} from '../../supabase/functions/_shared/metrics';
