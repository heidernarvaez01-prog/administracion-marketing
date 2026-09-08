import { calculateAuditMetrics } from './audit-calculations';
import { generateAlerts, DEFAULT_ALERT_THRESHOLDS } from './audit-alerts';
import type { AlertThresholds, AlertType } from './audit-alerts';
import type { ApiCampaignRow } from './api';
import type { AuditRowData } from '@/components/AuditTable';

// Spend from today and yesterday is excluded while platforms consolidate it.
export function getConsolidationCutoff(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const yyyy = cutoffDate.getFullYear();
  const mm = String(cutoffDate.getMonth() + 1).padStart(2, '0');
  const dd = String(cutoffDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function buildAuditRows(
  records: any[],
  apiData: ApiCampaignRow[],
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
  enabledTypes?: ReadonlySet<AlertType>,
): AuditRowData[] {
  const cutoff = getConsolidationCutoff();

  return records.map(rec => {
    const effectiveEnd = rec.fecha_fin < cutoff ? rec.fecha_fin : cutoff;
    const campaignApiData = apiData.filter(r =>
      r.campaign_name === rec.campaign_name &&
      r.date >= rec.fecha_inicio &&
      r.date <= effectiveEnd
    );
    const cost = campaignApiData.reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
    const metrics = calculateAuditMetrics(
      Number(rec.presupuesto_total),
      rec.fecha_inicio,
      rec.fecha_fin,
      rec.tipo_calendario,
      cost,
    );
    const alerts = generateAlerts(metrics, campaignApiData, thresholds, enabledTypes);
    return {
      ...rec,
      presupuesto_total: Number(rec.presupuesto_total),
      platform: rec.platform || undefined,
      metrics,
      alerts,
      campaignApiData,
    };
  });
}
