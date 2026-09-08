// Loads one user's per-rule alert thresholds + enabled flags from
// alert_rules, merged over the documented defaults in alert-engine.ts.
// Shared by alert-dispatch (dispatch time) and metrics-ai-analysis's
// get_active_alerts tool (on-demand, from the chat) so "what counts as an
// alert for this user" never drifts between the two call sites.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.0';
import {
  DEFAULT_ALERT_THRESHOLDS,
  ALERT_THRESHOLD_FIELDS,
  type AlertThresholds,
  type AlertType,
} from './alert-engine.ts';

const ALL_ALERT_TYPES = Object.keys(ALERT_THRESHOLD_FIELDS) as AlertType[];

export async function loadUserThresholds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ thresholds: AlertThresholds; enabledTypes: Set<AlertType> }> {
  const { data } = await supabase.from('alert_rules').select('*').eq('user_id', userId);
  const byType = new Map((data || []).map((r: any) => [r.rule_type as AlertType, r]));
  const thresholds: AlertThresholds = { ...DEFAULT_ALERT_THRESHOLDS };
  const enabledTypes = new Set<AlertType>();
  for (const type of ALL_ALERT_TYPES) {
    const row = byType.get(type);
    const fields = ALERT_THRESHOLD_FIELDS[type];
    (thresholds as any)[fields.primary] = row?.threshold != null ? Number(row.threshold) : DEFAULT_ALERT_THRESHOLDS[fields.primary];
    if (fields.secondary) {
      (thresholds as any)[fields.secondary] = row?.secondary_threshold != null
        ? Number(row.secondary_threshold)
        : DEFAULT_ALERT_THRESHOLDS[fields.secondary];
    }
    if (row?.enabled ?? true) enabledTypes.add(type);
  }
  return { thresholds, enabledTypes };
}
