// Lógica PURA de la "Regla de sincronización por cuenta" (ver CLAUDE.md).
// Sin APIs de Deno ni de red, para poder probarla en Node. Solo sintaxis TS
// borrable (sin enums ni parameter properties).

export const DAILY_WINDOW_DAYS = 7;
export const BACKFILL_WINDOW_DAYS = 35;
export const RECENT_DATA_DAYS = 30;

export interface AdAccount {
  account_id: string;
  account_name?: string | null;
  platform?: string | null;
  active: boolean;
  sync_mode: string; // 'auto' | 'always' | 'never' (CHECK en la base)
  last_data_date: string | null; // 'YYYY-MM-DD'
  last_probe_at?: string | null;
}

export interface FullSyncItem {
  account: AdAccount;
  windowDays: number;
  reason: "diario" | "backfill_primera_vez";
}

export interface SyncPlan {
  full: FullSyncItem[];
  dormant: AdAccount[];
  skipped: AdAccount[];
}

export interface ProbeSummary {
  rows: number;
  latestActivityDate: string | null;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIsoDate(new Date(Date.UTC(y, m - 1, d) + delta * 86400000));
}

export function maxDate(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/** "Tiene datos" = gasto o impresiones mayores a cero. */
export function hasActivity(spend: unknown, impressions: unknown): boolean {
  return Number(spend) > 0 || Number(impressions) > 0;
}

/** Fecha más reciente con spend>0 o impresiones>0 (null si ninguna). */
export function latestActivityDate(
  rows: { date: string | null; spend: unknown; impressions: unknown }[],
): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    if (r.date && hasActivity(r.spend, r.impressions)) latest = maxDate(latest, r.date);
  }
  return latest;
}

/**
 * Aplica la regla por cuenta:
 *  - active=false o sync_mode='never' -> omitida (ni sondeo).
 *  - 'always' -> sync completo siempre.
 *  - 'auto' con last_data_date de los últimos 30 días -> sync completo.
 *  - 'auto' sin datos recientes (null o viejo) -> dormida (solo sondeo).
 * Ventana del sync completo: 7 días, o 35 (backfill) si la cuenta nunca tuvo
 * un sync completo exitoso (firstSyncDone no la incluye).
 */
export function classifyAccounts(
  accounts: AdAccount[],
  today: string,
  firstSyncDone: Set<string>,
): SyncPlan {
  const recentCutoff = addDays(today, -RECENT_DATA_DAYS);
  const plan: SyncPlan = { full: [], dormant: [], skipped: [] };
  for (const account of accounts) {
    if (!account.active || account.sync_mode === "never") {
      plan.skipped.push(account);
      continue;
    }
    const recent = !!account.last_data_date && account.last_data_date >= recentCutoff;
    if (account.sync_mode === "always" || (account.sync_mode === "auto" && recent)) {
      const firstTime = !firstSyncDone.has(account.account_id);
      plan.full.push({
        account,
        windowDays: firstTime ? BACKFILL_WINDOW_DAYS : DAILY_WINDOW_DAYS,
        reason: firstTime ? "backfill_primera_vez" : "diario",
      });
    } else if (account.sync_mode === "auto") {
      plan.dormant.push(account);
    } else {
      plan.skipped.push(account); // sync_mode desconocido: no se toca
    }
  }
  return plan;
}

/**
 * Parámetros de fecha para Windsor. 7 días usa el preset ya verificado
 * (last_7d). Para el backfill NO se pudo verificar que exista un preset
 * "last_35d", así que se usa un rango explícito que termina AYER, igual que
 * los presets last_Nd (que no incluyen hoy). Si se confirma el preset,
 * basta cambiar la última línea.
 */
export function windsorRangeParams(windowDays: number, today: string): Record<string, string> {
  if (windowDays === DAILY_WINDOW_DAYS) return { date_preset: "last_7d" };
  return { date_from: addDays(today, -windowDays), date_to: addDays(today, -1) };
}

/** Resume la respuesta del sondeo por cuenta (incluye cuentas sin ninguna fila). */
export function summarizeProbe(
  // deno-lint-ignore no-explicit-any
  rows: any[],
  accountIds: string[],
): Map<string, ProbeSummary> {
  const out = new Map<string, ProbeSummary>();
  for (const id of accountIds) out.set(id, { rows: 0, latestActivityDate: null });
  for (const r of rows) {
    const s = out.get(String(r?.account_id));
    if (!s) continue;
    s.rows += 1;
    const date = typeof r.date === "string" ? r.date.slice(0, 10) : null;
    if (date && hasActivity(r.spend, r.impressions)) {
      s.latestActivityDate = maxDate(s.latestActivityDate, date);
    }
  }
  return out;
}

/**
 * Quita secretos de un mensaje antes de guardarlo o loguearlo. Deno incluye la
 * URL completa (con api_key) en los errores de red.
 */
export function sanitizeError(message: unknown, secrets: (string | undefined)[] = []): string {
  let out = String(message ?? "");
  for (const s of secrets) {
    if (s) out = out.split(s).join("***");
  }
  out = out.replace(/(api_key=)[^&\s)"']+/gi, "$1***");
  return out.length > 500 ? out.slice(0, 500) + "…" : out;
}
