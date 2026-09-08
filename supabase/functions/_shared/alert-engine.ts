// Canonical pacing-alert engine — pure TS, no React/DOM/Deno/Node APIs.
// This is the single source of truth for the 6 alert rules, imported both
// by the Vite frontend (src/lib/audit-alerts.ts re-exports it) and by
// Edge Functions (alert-dispatch, weekly-report) so the two runtimes can
// never drift apart. Do not duplicate this logic elsewhere — extend the
// thresholds instead.

export type AlertSeverity = 'info' | 'warning' | 'danger';

// High-signal alerts only — no noise, no generic blocks.
export type AlertType =
  | 'OVERSPEND_50'            // spend >= expected * (1 + overspendPct/100)
  | 'NOT_SPENDING'            // active campaign with zero recent spend
  | 'ENDING_SOON'             // campaign within endingSoonPctThreshold% of finishing
  | 'COST_SPIKE'              // CPC/CPM up more than costSpikePct% vs previous period
  | 'BUDGET_EARLY_DEPLETION'  // budget projected to run out earlyDepletionDays+ before end date
  | 'CREATIVE_FATIGUE'        // frequency above threshold + CTR down more than fatigueCtrDropPct%
  | 'BUDGET_MISMATCH';        // Meta's programmed daily budget diverges from the approved daily rate

export interface AuditAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  icon: string;
}

// Minimal shape this module needs from AuditMetrics (kept structural so the
// engine has zero import-time coupling to src/lib/audit-calculations.ts).
export interface AlertMetricsInput {
  gastoEsperado: number;
  gastoActual: number;
  diasRestantes: number;
  diasTranscurridos: number;
  diasTotales: number;
  porcentajeTiempo: number;
  gastoDiarioActual: number;
  presupuestoRestante: number;
  presupuestoDiarioIdeal: number;
}

export interface AlertCampaignRow {
  date: string; // YYYY-MM-DD
  metrics: {
    cost: number;
    clicks: number;
    impressions: number;
    frequency?: number | null;
    /** Meta's currently active daily budget for this campaign, if known. */
    dailyBudget?: number | null;
  };
}

// Every rule's tunable knobs. Values mirror the historical hardcoded
// constants — changing DEFAULT_ALERT_THRESHOLDS changes behavior for every
// caller that doesn't pass its own, so leave these as the documented
// baseline and let per-user overrides come from the `alert_rules` table.
export interface AlertThresholds {
  overspendPct: number;            // default 50
  notSpendingWindowDays: number;   // default 3
  endingSoonPctThreshold: number;  // default 90
  costSpikePct: number;            // default 65
  earlyDepletionDays: number;      // default 2
  fatigueMinFrequency: number;     // default 4
  fatigueCtrDropPct: number;       // default 20
  budgetMismatchPct: number;       // default 10
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  overspendPct: 50,
  notSpendingWindowDays: 3,
  endingSoonPctThreshold: 90,
  costSpikePct: 65,
  earlyDepletionDays: 2,
  fatigueMinFrequency: 4,
  fatigueCtrDropPct: 20,
  budgetMismatchPct: 10,
};

// rule_type -> which threshold field(s) it reads, used by callers that
// hydrate AlertThresholds from the `alert_rules` table (threshold /
// secondary_threshold columns).
export const ALERT_THRESHOLD_FIELDS: Record<AlertType, { primary: keyof AlertThresholds; secondary?: keyof AlertThresholds }> = {
  OVERSPEND_50: { primary: 'overspendPct' },
  NOT_SPENDING: { primary: 'notSpendingWindowDays' },
  ENDING_SOON: { primary: 'endingSoonPctThreshold' },
  COST_SPIKE: { primary: 'costSpikePct' },
  BUDGET_EARLY_DEPLETION: { primary: 'earlyDepletionDays' },
  CREATIVE_FATIGUE: { primary: 'fatigueMinFrequency', secondary: 'fatigueCtrDropPct' },
  BUDGET_MISMATCH: { primary: 'budgetMismatchPct' },
};

// Sum a metric over rows within [from, to] (date strings YYYY-MM-DD inclusive)
function sumWindow(
  rows: AlertCampaignRow[],
  from: string,
  to: string,
  pick: (m: AlertCampaignRow['metrics']) => number,
): number {
  return rows
    .filter(r => r.date >= from && r.date <= to)
    .reduce((s, r) => s + (isNaN(pick(r.metrics)) ? 0 : pick(r.metrics)), 0);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function generateAlerts(
  metrics: AlertMetricsInput,
  campaignApiData: AlertCampaignRow[],
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
  enabledTypes?: ReadonlySet<AlertType>,
): AuditAlert[] {
  const t = thresholds;
  const isEnabled = (type: AlertType) => !enabledTypes || enabledTypes.has(type);
  const alerts: AuditAlert[] = [];
  const inFlight = metrics.diasRestantes > 0 && metrics.diasTranscurridos > 0;

  // Consolidated data excludes today and yesterday
  const lastConsolidated = isoDaysAgo(2);

  // ── 1. X%+ above expected spend to date ────────────────────────────────
  const overspendMultiplier = 1 + t.overspendPct / 100;
  if (isEnabled('OVERSPEND_50') && metrics.gastoEsperado > 0 && metrics.gastoActual >= metrics.gastoEsperado * overspendMultiplier) {
    const pctAbove = ((metrics.gastoActual - metrics.gastoEsperado) / metrics.gastoEsperado * 100).toFixed(0);
    alerts.push({
      type: 'OVERSPEND_50',
      severity: 'danger',
      message: `Gasto ${pctAbove}% por encima de lo esperado a la fecha ($${metrics.gastoActual.toFixed(2)} vs $${metrics.gastoEsperado.toFixed(2)} esperado). Limita el gasto diario a $${metrics.presupuestoDiarioIdeal.toFixed(2)} para recuperar el ritmo.`,
      icon: '🔴',
    });
  }

  // ── 2. Campaign is not spending ───────────────────────────────────────
  if (isEnabled('NOT_SPENDING') && inFlight && metrics.diasTranscurridos >= t.notSpendingWindowDays) {
    const recentSpend = sumWindow(campaignApiData, isoDaysAgo(t.notSpendingWindowDays + 1), lastConsolidated, m => m.cost);
    if (recentSpend === 0) {
      alerts.push({
        type: 'NOT_SPENDING',
        severity: 'danger',
        message: `Sin gasto registrado en los últimos ${t.notSpendingWindowDays} días consolidados. La campaña puede estar pausada, rechazada o topada por presupuesto — revisa la entrega ahora.`,
        icon: '⛔',
      });
    }
  }

  // ── 3. Campaign within X% of finishing ──────────────────────────────────
  if (isEnabled('ENDING_SOON') && metrics.porcentajeTiempo >= t.endingSoonPctThreshold && metrics.diasRestantes > 0) {
    alerts.push({
      type: 'ENDING_SOON',
      severity: 'info',
      message: `La campaña va en ${metrics.porcentajeTiempo.toFixed(0)}% de su cronograma (quedan ${metrics.diasRestantes} día${metrics.diasRestantes === 1 ? '' : 's'}). Saldo restante: $${metrics.presupuestoRestante.toFixed(2)} — planea la renovación o el cierre.`,
      icon: '🏁',
    });
  }

  // ── 4. Costs spiked above X% ────────────────────────────────────────────
  if (isEnabled('COST_SPIKE') && inFlight) {
    const recentFrom = isoDaysAgo(4);
    const prevFrom = isoDaysAgo(11);
    const prevTo = isoDaysAgo(5);
    const spikeMultiplier = 1 + t.costSpikePct / 100;

    const rCost = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.cost);
    const rClicks = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.clicks);
    const rImpr = sumWindow(campaignApiData, recentFrom, lastConsolidated, m => m.impressions);
    const pCost = sumWindow(campaignApiData, prevFrom, prevTo, m => m.cost);
    const pClicks = sumWindow(campaignApiData, prevFrom, prevTo, m => m.clicks);
    const pImpr = sumWindow(campaignApiData, prevFrom, prevTo, m => m.impressions);

    const rCpc = rClicks > 0 ? rCost / rClicks : 0;
    const pCpc = pClicks > 0 ? pCost / pClicks : 0;
    const rCpm = rImpr > 0 ? (rCost / rImpr) * 1000 : 0;
    const pCpm = pImpr > 0 ? (pCost / pImpr) * 1000 : 0;

    if (pCpc > 0 && rCpc > pCpc * spikeMultiplier) {
      const pct = ((rCpc - pCpc) / pCpc * 100).toFixed(0);
      alerts.push({
        type: 'COST_SPIKE',
        severity: 'danger',
        message: `El CPC subió ${pct}% vs. la semana anterior ($${rCpc.toFixed(2)} vs $${pCpc.toFixed(2)}). Revisa segmentación, creativos o cambios de subasta.`,
        icon: '📈',
      });
    } else if (pCpm > 0 && rCpm > pCpm * spikeMultiplier) {
      const pct = ((rCpm - pCpm) / pCpm * 100).toFixed(0);
      alerts.push({
        type: 'COST_SPIKE',
        severity: 'danger',
        message: `El CPM subió ${pct}% vs. la semana anterior ($${rCpm.toFixed(2)} vs $${pCpm.toFixed(2)}). Revisa segmentación, creativos o cambios de subasta.`,
        icon: '📈',
      });
    }
  }

  // ── 5. Budget projected to run out early ────────────────────────────────
  if (isEnabled('BUDGET_EARLY_DEPLETION') && inFlight && metrics.gastoDiarioActual > 0 && metrics.presupuestoRestante > 0) {
    const daysUntilDepletion = metrics.presupuestoRestante / metrics.gastoDiarioActual;
    const daysEarly = metrics.diasRestantes - daysUntilDepletion;
    if (daysEarly >= t.earlyDepletionDays) {
      alerts.push({
        type: 'BUDGET_EARLY_DEPLETION',
        severity: 'warning',
        message: `Al ritmo actual ($${metrics.gastoDiarioActual.toFixed(2)}/día), el presupuesto se agota ~${Math.round(daysEarly)} días antes de la fecha de fin. Reduce el gasto diario a $${metrics.presupuestoDiarioIdeal.toFixed(2)} para que alcance todo el período.`,
        icon: '⏳',
      });
    }
  }

  // ── 6. Creative fatigue ───────────────────────────────────────────────
  if (isEnabled('CREATIVE_FATIGUE') && inFlight) {
    const recentRows = campaignApiData.filter(r => r.date >= isoDaysAgo(8) && r.date <= lastConsolidated);
    const prevRows = campaignApiData.filter(r => r.date >= isoDaysAgo(15) && r.date <= isoDaysAgo(9));
    const avgFreq = recentRows.length
      ? recentRows.reduce((s, r) => s + (r.metrics.frequency || 0), 0) / recentRows.length
      : 0;
    const rClicks = recentRows.reduce((s, r) => s + r.metrics.clicks, 0);
    const rImpr = recentRows.reduce((s, r) => s + r.metrics.impressions, 0);
    const pClicks = prevRows.reduce((s, r) => s + r.metrics.clicks, 0);
    const pImpr = prevRows.reduce((s, r) => s + r.metrics.impressions, 0);
    const rCtr = rImpr > 0 ? (rClicks / rImpr) * 100 : 0;
    const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0;
    const fatigueCtrRatio = 1 - t.fatigueCtrDropPct / 100;

    if (avgFreq > t.fatigueMinFrequency && pCtr > 0 && rCtr < pCtr * fatigueCtrRatio) {
      alerts.push({
        type: 'CREATIVE_FATIGUE',
        severity: 'warning',
        message: `Fatiga creativa: frecuencia en ${avgFreq.toFixed(1)} y CTR bajó ${(100 - (rCtr / pCtr) * 100).toFixed(0)}% vs. la semana pasada (${rCtr.toFixed(2)}% vs ${pCtr.toFixed(2)}%). Es momento de rotar creativos o refrescar audiencias.`,
        icon: '🎨',
      });
    }
  }

  // ── 7. Programmed budget diverges from the approved rate ────────────────
  // Compares Meta's currently active daily_budget (what's actually
  // programmed on the platform) against the flat approved daily rate
  // (total approved budget / total scheduled days) — independent of
  // today's pacing, this catches "someone changed the budget in Meta and
  // it no longer matches what was approved" even if spend still looks OK.
  if (isEnabled('BUDGET_MISMATCH') && metrics.diasTotales > 0) {
    const approvedTotal = metrics.gastoActual + metrics.presupuestoRestante;
    const approvedDaily = approvedTotal / metrics.diasTotales;
    const latestWithBudget = [...campaignApiData]
      .filter(r => r.metrics.dailyBudget != null && r.metrics.dailyBudget > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const programmedDaily = latestWithBudget?.metrics.dailyBudget ?? null;

    if (programmedDaily != null && approvedDaily > 0) {
      const diffPct = ((programmedDaily - approvedDaily) / approvedDaily) * 100;
      if (Math.abs(diffPct) >= t.budgetMismatchPct) {
        const direction = diffPct > 0 ? 'above' : 'below';
        alerts.push({
          type: 'BUDGET_MISMATCH',
          severity: 'warning',
          message: `El presupuesto diario programado en Meta ($${programmedDaily.toFixed(2)}) está ${Math.abs(diffPct).toFixed(0)}% ${direction === 'above' ? 'por encima' : 'por debajo'} de la tasa diaria aprobada ($${approvedDaily.toFixed(2)}). Confirma que el cambio de presupuesto fue autorizado.`,
          icon: '⚖️',
        });
      }
    }
  }

  return alerts;
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  OVERSPEND_50: '50%+ sobre el gasto esperado',
  NOT_SPENDING: 'Campaña sin gasto',
  ENDING_SOON: 'Campaña por finalizar',
  COST_SPIKE: 'Pico de costo >65%',
  BUDGET_EARLY_DEPLETION: 'Presupuesto se agota antes de tiempo',
  CREATIVE_FATIGUE: 'Fatiga creativa',
  BUDGET_MISMATCH: 'Presupuesto programado no coincide',
};
