// The pacing-alert rules now live in one canonical, runtime-agnostic module
// so the frontend and Edge Functions (alert-dispatch, weekly-report) can
// never drift apart. See supabase/functions/_shared/alert-engine.ts.
export {
  generateAlerts,
  ALERT_TYPE_LABELS,
  DEFAULT_ALERT_THRESHOLDS,
  ALERT_THRESHOLD_FIELDS,
} from '../../supabase/functions/_shared/alert-engine';
export type {
  AlertSeverity,
  AlertType,
  AuditAlert,
  AlertThresholds,
  AlertMetricsInput,
  AlertCampaignRow,
} from '../../supabase/functions/_shared/alert-engine';
