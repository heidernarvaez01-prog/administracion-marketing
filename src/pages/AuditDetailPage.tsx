import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchCampaignData, type ApiCampaignRow } from '@/lib/api';
import { calculateAuditMetrics, getTipoCalendarioLabel } from '@/lib/audit-calculations';
import { generateAlerts } from '@/lib/audit-alerts';
import { aggregateTotals, getPlacementBreakdown, getAdLeaderboard, getRankingSummary, getFunnelBreakdown, bucketRanking } from '@/lib/metrics';
import { useAlertThresholds } from '@/hooks/useAlertThresholds';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PacingBar from '@/components/PacingBar';
import PerformanceCharts from '@/components/PerformanceCharts';
import { toast } from 'sonner';

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

function prettyRanking(v: string | null): string {
  if (!v || v === 'UNKNOWN') return 'Desconocido';
  return v.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
}

interface InsightData {
  insight: string;
  riskLevel: 'critical' | 'moderate' | 'none';
}

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<any>(null);
  const [apiData, setApiData] = useState<ApiCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const { thresholds, enabledTypes } = useAlertThresholds();

  useEffect(() => {
    (async () => {
      try {
        const [{ data: rec, error }, api] = await Promise.all([
          supabase.from('audit_records').select('*').eq('id', id).maybeSingle(),
          fetchCampaignData(),
        ]);
        if (error) throw error;
        if (!rec) {
          toast.error('Auditoría no encontrada');
          navigate('/app');
          return;
        }
        setRecord(rec);
        setApiData(api);
      } catch (e) {
        console.error(e);
        toast.error('Error al cargar la auditoría');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const { metrics, alerts, campaignApiData, perf, placements, rankings, adLeaderboard, funnel } = useMemo(() => {
    if (!record) return { metrics: null, alerts: [], campaignApiData: [], perf: null, placements: [], rankings: null, adLeaderboard: [], funnel: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yyyy = cutoffDate.getFullYear();
    const mm = String(cutoffDate.getMonth() + 1).padStart(2, '0');
    const dd = String(cutoffDate.getDate()).padStart(2, '0');
    const cutoff = `${yyyy}-${mm}-${dd}`;
    const effectiveEnd = record.fecha_fin < cutoff ? record.fecha_fin : cutoff;
    const campaignApiData = apiData.filter(
      r =>
        r.campaign_name === record.campaign_name &&
        r.date >= record.fecha_inicio &&
        r.date <= effectiveEnd,
    );
    const totals = aggregateTotals(campaignApiData);
    const metrics = calculateAuditMetrics(
      Number(record.presupuesto_total),
      record.fecha_inicio,
      record.fecha_fin,
      record.tipo_calendario,
      totals.cost,
    );
    const alerts = generateAlerts(metrics, campaignApiData, thresholds, enabledTypes);

    // Spend/CTR split by placement (Facebook Feed, Instagram, Audience
    // Network, ...) — which of Meta's delivery surfaces is actually working.
    const placements = getPlacementBreakdown(campaignApiData);

    // Ad health = Meta's own 3 quality diagnostics from the most recent row.
    const rankings = getRankingSummary(campaignApiData);

    // Ad-level leaderboard — which individual creative to keep/rotate, not
    // just "the campaign" in aggregate. Requires ad_id from Windsor; rows
    // without it (older syncs) are grouped under "Unknown ad".
    const adLeaderboard = getAdLeaderboard(campaignApiData);

    // Funnel: where the drop-off actually happens between an impression and
    // a completed purchase — the diagnosis a flat CTR/ROAS number can't give.
    const funnel = getFunnelBreakdown(campaignApiData);

    return {
      metrics,
      alerts,
      campaignApiData,
      perf: { clicks: totals.clicks, impressions: totals.impressions, reach: totals.reach, cpc: totals.cpc, cpm: totals.cpm, ctr: totals.ctr },
      placements,
      rankings,
      adLeaderboard,
      funnel,
    };
  }, [record, apiData, thresholds, enabledTypes]);

  const generateInsight = async () => {
    if (!record || !metrics || !perf) return;
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-insight', {
        body: {
          campaignData: {
            campaignName: record.campaign_name,
            platform: record.platform,
            presupuestoTotal: record.presupuesto_total.toFixed(2),
            gastoActual: metrics.gastoActual.toFixed(2),
            presupuestoRestante: metrics.presupuestoRestante.toFixed(2),
            diasTranscurridos: metrics.diasTranscurridos,
            diasRestantes: metrics.diasRestantes,
            pacingStatus: metrics.pacingStatus,
            pacingPct: metrics.pacingPct.toFixed(1),
            gastoDiarioActual: metrics.gastoDiarioActual.toFixed(2),
            presupuestoDiarioIdeal: metrics.presupuestoDiarioIdeal.toFixed(2),
            ctr: perf.ctr.toFixed(2),
            cpc: perf.cpc.toFixed(2),
            impressions: perf.impressions,
            clicks: perf.clicks,
            reach: perf.reach,
          },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setInsight(data as InsightData);
    } catch (e) {
      console.error(e);
      toast.error('Error al generar el diagnóstico de IA');
    } finally {
      setLoadingInsight(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!record || !metrics || !perf) return null;

  const statusVariant =
    metrics.pacingStatus === 'SOBREGASTANDO'
      ? 'destructive'
      : metrics.pacingStatus === 'SUBGASTANDO'
        ? 'default'
        : 'default';
  const statusLabel =
    metrics.pacingStatus === 'SOBREGASTANDO'
      ? 'Sobregastando'
      : metrics.pacingStatus === 'SUBGASTANDO'
        ? 'Subgastando'
        : 'En ritmo';

  const accountName = campaignApiData[0]?.account_name || record.account_id;

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(record.client_id ? `/app/client/${record.client_id}` : '/app')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{record.campaign_name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accountName} · {record.platform?.toUpperCase()} · {getTipoCalendarioLabel(record.tipo_calendario)}
            </p>
          </div>
        </div>
        <Badge variant={statusVariant} className="text-xs">{statusLabel}</Badge>
      </div>

      {/* Pacing card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Ritmo de gasto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PacingBar
            porcentajeTiempo={metrics.porcentajeTiempo}
            porcentajeGasto={metrics.porcentajeGastado}
            status={metrics.pacingStatus}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Presupuesto" value={fmt(record.presupuesto_total)} />
            <Stat
              label="Gasto actual"
              value={fmt(metrics.gastoActual)}
              color={metrics.pacingStatus === 'SOBREGASTANDO' ? 'text-destructive' : undefined}
            />
            <Stat label="Restante" value={fmt(metrics.presupuestoRestante)} />
            <Stat label="Ritmo" value={`${metrics.pacingPct >= 0 ? '+' : ''}${metrics.pacingPct.toFixed(1)}%`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Días totales" value={String(metrics.diasTotales)} />
            <Stat label="Días transcurridos" value={String(metrics.diasTranscurridos)} />
            <Stat label="Días restantes" value={String(metrics.diasRestantes)} />
            <Stat label="Ideal diario" value={fmt(metrics.presupuestoDiarioIdeal)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Gasto diario actual" value={fmt(metrics.gastoDiarioActual)} />
            <Stat label="Gasto esperado" value={fmt(metrics.gastoEsperado)} />
            <Stat label="Fecha de inicio" value={record.fecha_inicio} />
            <Stat label="Fecha de fin" value={record.fecha_fin} />
          </div>
        </CardContent>
      </Card>

      {/* API metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Métricas de rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <Stat label="Clics" value={fmtNum(perf.clicks)} />
            <Stat label="Impresiones" value={fmtNum(perf.impressions)} />
            <Stat label="Alcance" value={fmtNum(perf.reach)} />
            <Stat label="CTR" value={`${perf.ctr.toFixed(2)}%`} />
            <Stat label="CPC" value={fmt(perf.cpc)} />
            <Stat label="CPM" value={fmt(perf.cpm)} />
          </div>
        </CardContent>
      </Card>

      {/* Ad quality + placement breakdown */}
      {rankings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Calidad del anuncio y placement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <RankingBadge label="Calidad" value={rankings.quality} />
              <RankingBadge label="Tasa de interacción" value={rankings.engagement} />
              <RankingBadge label="Tasa de conversión" value={rankings.conversion} />
            </div>
            {/* publisher_platform can't be requested together with the omni/ranking
                fields above (Windsor API constraint — see sync-meta-datos), so this
                is only ever real when a future dedicated placement sync exists. */}
            {(placements.length > 1 || (placements.length === 1 && placements[0].name !== 'Desconocido')) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Gasto por placement</p>
                <div className="space-y-1.5">
                  {placements.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-muted/40">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground">{fmt(p.cost)} · {p.ctr.toFixed(2)}% CTR</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ad-level leaderboard — which specific creative to keep or rotate */}
      {adLeaderboard.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Mejores anuncios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {adLeaderboard.map((ad, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs px-2.5 py-1.5 rounded-md bg-muted/40">
                  <span className="font-medium text-foreground truncate min-w-0 flex-1">{ad.name}</span>
                  <span className="text-muted-foreground shrink-0">{fmt(ad.cost)}</span>
                  <span className="text-muted-foreground shrink-0">{ad.ctr.toFixed(2)}% CTR</span>
                  <span className="text-muted-foreground shrink-0">{ad.roas != null ? `${ad.roas.toFixed(2)}x ROAS` : '—'}</span>
                  <span className="shrink-0"><RankingBadge label="" value={ad.quality} /></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion funnel — where the drop-off actually happens */}
      {funnel.length > 0 && funnel[0].value > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Funnel de conversión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {funnel.map((step, i) => {
              const pctOfTop = (step.value / funnel[0].value) * 100;
              const prev = i > 0 ? funnel[i - 1].value : null;
              const pctOfPrev = prev && prev > 0 ? (step.value / prev) * 100 : null;
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-foreground">{step.label}</span>
                    <span className="text-muted-foreground">
                      {fmtNum(step.value)}{pctOfPrev != null && ` · ${pctOfPrev.toFixed(0)}% del paso anterior`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(pctOfTop, step.value > 0 ? 1.5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Tendencias</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceCharts
            apiRows={campaignApiData}
            budget={Number(record.presupuesto_total)}
            level="campaign"
          />
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded text-xs font-medium ${
                    alert.severity === 'danger'
                      ? 'bg-destructive/10 text-destructive'
                      : alert.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-success/10 text-success'
                  }`}
                >
                  {alert.icon} {alert.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insight */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Diagnóstico de IA</CardTitle>
          <Button variant="outline" size="sm" onClick={generateInsight} disabled={loadingInsight}>
            {loadingInsight ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loadingInsight ? 'Analizando...' : 'Generar diagnóstico'}
          </Button>
        </CardHeader>
        <CardContent>
          {insight ? (
            <div
              className={`p-3 rounded-md border ${
                insight.riskLevel === 'critical'
                  ? 'border-destructive/40 bg-destructive/5'
                  : insight.riskLevel === 'moderate'
                    ? 'border-warning/40 bg-warning/5'
                    : 'border-success/40 bg-success/5'
              }`}
            >
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{insight.insight}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Genera un diagnóstico de IA basado en el estado actual de esta auditoría.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankingBadge({ label, value }: { label: string; value: string | null }) {
  const bucket = bucketRanking(value);
  const style = {
    above: 'bg-success/10 text-success border-success/30',
    average: 'bg-muted text-muted-foreground border-border',
    below: 'bg-destructive/10 text-destructive border-destructive/30',
    unknown: 'bg-muted text-muted-foreground border-border',
  }[bucket];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>
      {label ? `${label}: ` : ''}{prettyRanking(value)}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold font-mono ${color || 'text-foreground'}`}>{value}</p>
    </div>
  );
}
