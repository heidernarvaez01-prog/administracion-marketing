import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_ALERT_THRESHOLDS,
  ALERT_THRESHOLD_FIELDS,
  type AlertThresholds,
  type AlertType,
} from '@/lib/audit-alerts';

const ALL_ALERT_TYPES = Object.keys(ALERT_THRESHOLD_FIELDS) as AlertType[];

export interface UserAlertRule {
  type: AlertType;
  enabled: boolean;
  threshold: number;
  secondaryThreshold: number | null;
}

/**
 * Loads the current user's `alert_rules` (per-rule enable + threshold),
 * merges them over DEFAULT_ALERT_THRESHOLDS, and exposes a ready-to-use
 * thresholds object + enabled-type set for generateAlerts(). Used by every
 * page that computes alerts, so a threshold change on /alerts applies
 * consistently app-wide instead of being scoped to that one page.
 */
export function useAlertThresholds() {
  const { user } = useAuth();
  const [rules, setRules] = useState<UserAlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('alert_rules').select('*').eq('user_id', user.id);
      if (cancelled) return;
      const byType = new Map((data || []).map(r => [r.rule_type as AlertType, r]));
      setRules(ALL_ALERT_TYPES.map(type => {
        const row = byType.get(type);
        const fields = ALERT_THRESHOLD_FIELDS[type];
        return {
          type,
          enabled: row?.enabled ?? true,
          threshold: row?.threshold != null ? Number(row.threshold) : DEFAULT_ALERT_THRESHOLDS[fields.primary],
          secondaryThreshold: row?.secondary_threshold != null
            ? Number(row.secondary_threshold)
            : fields.secondary ? DEFAULT_ALERT_THRESHOLDS[fields.secondary] : null,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Memoized on `rules` (only changes when data actually changes) — these
  // are consumed as effect/useMemo deps elsewhere, so recreating them every
  // render would cause an infinite refetch loop downstream.
  const { thresholds, enabledTypes } = useMemo(() => {
    const t: AlertThresholds = { ...DEFAULT_ALERT_THRESHOLDS };
    const enabled = new Set<AlertType>();
    for (const r of rules) {
      const fields = ALERT_THRESHOLD_FIELDS[r.type];
      (t as any)[fields.primary] = r.threshold;
      if (fields.secondary && r.secondaryThreshold != null) (t as any)[fields.secondary] = r.secondaryThreshold;
      if (r.enabled) enabled.add(r.type);
    }
    return { thresholds: t, enabledTypes: enabled };
  }, [rules]);

  const saveRule = async (rule: UserAlertRule) => {
    if (!user) return { error: new Error('No has iniciado sesión') };
    const { error } = await supabase.from('alert_rules').upsert(
      {
        user_id: user.id,
        rule_type: rule.type,
        enabled: rule.enabled,
        threshold: rule.threshold,
        secondary_threshold: rule.secondaryThreshold,
      },
      { onConflict: 'user_id,rule_type' },
    );
    if (!error) setRules(prev => prev.map(r => (r.type === rule.type ? rule : r)));
    return { error };
  };

  return { rules, thresholds, enabledTypes, loading, saveRule };
}
