import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Sparkles, Loader2, ExternalLink, Gauge, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import HScroll from '@/components/HScroll';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import PacingBar from '@/components/PacingBar';
import { MetricInfo } from '@/components/MetricInfo';
import { supabase } from '@/integrations/supabase/client';
import PerformanceCharts from '@/components/PerformanceCharts';
import { toast } from 'sonner';
import type { AuditMetrics } from '@/lib/audit-calculations';
import type { AuditAlert } from '@/lib/audit-alerts';
import type { ApiCampaignRow } from '@/lib/api';

type RecordPatch = Partial<{
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: string;
  presupuesto_total: number;
}>;

export interface AuditRowData {
  id: string;
  account_id: string;
  campaign_name: string;
  presupuesto_total: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_calendario: string;
  platform?: string;
  metrics: AuditMetrics;
  alerts: AuditAlert[];
  campaignApiData: ApiCampaignRow[];
}

interface Props {
  rows: AuditRowData[];
  onEdit: (row: AuditRowData) => void;
  onDelete: (id: string) => void;
  onUpdateRecord?: (id: string, patch: RecordPatch) => void;
}

interface InsightData {
  insight: string;
  riskLevel: 'critical' | 'moderate' | 'none';
}

// Period filter for the Performance view (visualize any date range)
export type PerfPeriod = 'all' | 'last_7' | 'last_30' | 'this_month' | 'last_month' | 'custom';
export const PERF_PERIOD_LABELS: Record<PerfPeriod, string> = {
  all: 'Campaña completa',
  last_7: 'Últimos 7 días',
  last_30: 'Últimos 30 días',
  this_month: 'Este mes',
  last_month: 'Mes pasado',
  custom: 'Rango personalizado',
};

export function periodWindow(p: PerfPeriod, cf?: string, ct?: string): { from: string; to: string } | null {
  if (p === 'all') return null;
  if (p === 'custom') {
    if (!cf && !ct) return null;
    return { from: cf || '0000-01-01', to: ct || '9999-12-31' };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === 'last_7') { const f = new Date(today); f.setDate(f.getDate() - 7); return { from: iso(f), to: iso(today) }; }
  if (p === 'last_30') { const f = new Date(today); f.setDate(f.getDate() - 30); return { from: iso(f), to: iso(today) }; }
  if (p === 'this_month') { return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }; }
  // last_month
  return {
    from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: iso(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

export function filterByPeriod(rows: ApiCampaignRow[], p: PerfPeriod, cf?: string, ct?: string): ApiCampaignRow[] {
  const w = periodWindow(p, cf, ct);
  if (!w) return rows;
  return rows.filter(r => r.date >= w.from && r.date <= w.to);
}

// Aggregated real-time performance for one audited campaign
interface RowPerf {
  impressions: number;
  reach: number;
  conversions: number;
  clicks: number;
  linkClicks: number;
  interactions: number;
  ctr: number;
  thruplay: number;
  cpm: number;
  cpc: number;
  engagementRate: number;
}

function computePerf(api: ApiCampaignRow[]): RowPerf {
  const sum = (f: (m: ApiCampaignRow['metrics']) => number) =>
    api.reduce((s, r) => s + (isNaN(f(r.metrics)) ? 0 : f(r.metrics)), 0);
  const impressions = sum(m => m.impressions);
  const clicks = sum(m => m.clicks);
  const cost = sum(m => m.cost);
  const interactions = sum(m => m.interactions);
  return {
    impressions,
    reach: sum(m => m.reach),
    conversions: sum(m => m.conversions),
    clicks,
    linkClicks: sum(m => m.link_clicks),
    interactions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    thruplay: sum(m => m.thruplay_actions),
    cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    engagementRate: impressions > 0 ? (interactions / impressions) * 100 : 0,
  };
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const PLATFORM_COLORS: Record<string, string> = {
  meta: 'bg-platform-meta text-white',
  google: 'bg-platform-google text-white',
  tiktok: 'bg-foreground text-background',
  linkedin: 'bg-platform-linkedin text-white',
};

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null;
  const colorClass = PLATFORM_COLORS[platform.toLowerCase()] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colorClass}`}>
      {platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'SOBREGASTANDO') {
    return <Badge variant="destructive" className="text-[10px] px-1.5">Sobregastando</Badge>;
  }
  if (status === 'SUBGASTANDO') {
    return <Badge className="text-[10px] px-1.5 bg-warning text-warning-foreground hover:bg-warning/90">Subgastando</Badge>;
  }
  return (
    <Badge className="text-[10px] px-1.5 bg-success text-success-foreground hover:bg-success/90 gap-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-foreground/80 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-foreground" />
      </span>
      En ritmo
    </Badge>
  );
}

// % Actual colored against % Expected: the heart of pacing clarity
function ActualPctCell({ actual, expected }: { actual: number; expected: number }) {
  const diff = actual - expected;
  const color = Math.abs(diff) <= 10
    ? 'text-success'
    : diff < 0
      ? 'text-warning'
      : 'text-destructive';
  return (
    <span className={`font-mono text-xs font-bold ${color}`}>
      {fmtPct(actual)}
    </span>
  );
}

function RiskIndicator({ insight }: { insight: InsightData }) {
  if (insight.riskLevel === 'none') return null;
  const isCritical = insight.riskLevel === 'critical';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help text-base ${isCritical ? 'animate-pulse' : ''}`}>
            {isCritical ? '🚨' : '⚠️'}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-xs whitespace-pre-line">
          {insight.insight}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold font-mono text-foreground">{value}</p>
    </div>
  );
}

function CampaignSummary({ row }: { row: AuditRowData }) {
  const m = row.metrics;
  const p = computePerf(row.campaignApiData);
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaña</p>
        <p className="text-sm font-semibold text-foreground line-clamp-2">{row.campaign_name}</p>
        {row.platform && <PlatformBadge platform={row.platform} />}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border">
        <MetricMini label="Gasto" value={fmt(m.gastoActual)} />
        <MetricMini label="Presupuesto" value={fmt(row.presupuesto_total)} />
        <MetricMini label="% Esperado" value={fmtPct(m.porcentajeTiempo)} />
        <MetricMini label="% Actual" value={fmtPct(m.porcentajeGastado)} />
        <MetricMini label="Ideal diario" value={fmt(m.presupuestoDiarioIdeal)} />
        <MetricMini label="Restante" value={fmt(m.presupuestoRestante)} />
        <MetricMini label="CTR" value={fmtPct(p.ctr)} />
        <MetricMini label="CPC" value={fmt(p.cpc)} />
      </div>
      {row.alerts.length > 0 && (
        <div className="pt-1.5 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Alertas</p>
          <p className="text-[11px] text-foreground">{row.alerts[0].icon} {row.alerts[0].message}</p>
        </div>
      )}
    </div>
  );
}

function InsightPanel({ insight }: { insight: InsightData }) {
  const borderColor = insight.riskLevel === 'critical'
    ? 'border-destructive/40 bg-destructive/5'
    : insight.riskLevel === 'moderate'
      ? 'border-warning/40 bg-warning/5'
      : 'border-success/40 bg-success/5';

  return (
    <div className={`p-3 rounded-md border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insight de IA</p>
      </div>
      <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{insight.insight}</p>
    </div>
  );
}

function ExpandedDetails({
  row,
  insight,
  loadingInsight,
  onGenerateInsight,
  period = 'all',
  customFrom,
  customTo,
}: {
  row: AuditRowData;
  insight: InsightData | null;
  loadingInsight: boolean;
  onGenerateInsight: () => void;
  period?: PerfPeriod;
  customFrom?: string;
  customTo?: string;
}) {
  const m = row.metrics;
  const periodRows = filterByPeriod(row.campaignApiData, period, customFrom, customTo);
  const p = computePerf(periodRows);

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Pacing bar — visual summary of expected vs actual */}
      <div className="pt-3">
        <PacingBar
          porcentajeTiempo={m.porcentajeTiempo}
          porcentajeGasto={m.porcentajeGastado}
          status={m.pacingStatus}
        />
      </div>

      {/* Performance Charts */}
      <PerformanceCharts
        apiRows={periodRows}
        budget={row.presupuesto_total}
        level="campaign"
      />

      {period !== 'all' && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          Mostrando rendimiento de <span className="font-medium text-foreground">{PERF_PERIOD_LABELS[period]}</span>.
        </p>
      )}

      {/* Full performance metrics */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Impresiones" value={fmtNum(p.impressions)} />
        <MetricMini label="Alcance" value={fmtNum(p.reach)} />
        <MetricMini label="Conversiones" value={fmtNum(p.conversions)} />
        <MetricMini label="Clics" value={fmtNum(p.clicks)} />
        <MetricMini label="Clics al enlace" value={fmtNum(p.linkClicks)} />
        <MetricMini label="Interacciones" value={fmtNum(p.interactions)} />
        <MetricMini label="CTR" value={fmtPct(p.ctr)} />
        <MetricMini label="Thruplay" value={fmtNum(p.thruplay)} />
        <MetricMini label="CPM" value={fmt(p.cpm)} />
        <MetricMini label="CPC" value={fmt(p.cpc)} />
        <MetricMini label="Interacción" value={fmtPct(p.engagementRate)} />
        <MetricMini label="Prom. gasto diario" value={fmt(m.gastoDiarioActual)} />
      </div>

      {/* Pacing detail */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-muted/50 border border-border">
        <MetricMini label="Días totales" value={m.diasTotales.toString()} />
        <MetricMini label="Días transcurridos" value={m.diasTranscurridos.toString()} />
        <MetricMini label="Días restantes" value={m.diasRestantes.toString()} />
        <MetricMini label="Gasto esperado" value={fmt(m.gastoEsperado)} />
      </div>

      {/* AI Insight */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateInsight}
          disabled={loadingInsight}
          className="text-xs"
        >
          {loadingInsight ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {loadingInsight ? 'Analizando...' : 'Generar insight de IA'}
        </Button>
      </div>

      {insight && <InsightPanel insight={insight} />}

      {/* Alerts */}
      {row.alerts.length > 0 && (
        <div className="space-y-1.5">
          {row.alerts.map((alert, i) => (
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
    </div>
  );
}

export default function AuditTable({ rows, onEdit, onDelete, onUpdateRecord }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [insights, setInsights] = useState<Record<string, InsightData>>({});
  const [loadingInsights, setLoadingInsights] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'pacing' | 'performance'>('pacing');
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const perfByRow = useMemo(() => {
    const map = new Map<string, RowPerf>();
    for (const row of rows) map.set(row.id, computePerf(filterByPeriod(row.campaignApiData, perfPeriod, customFrom, customTo)));
    return map;
  }, [rows, perfPeriod, customFrom, customTo]);

  // Spend within the selected period (for the Budget Pacing "Actual Spend" column)
  const periodSpendByRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const sum = filterByPeriod(row.campaignApiData, perfPeriod, customFrom, customTo)
        .reduce((s, r) => s + (isNaN(r.metrics.cost) ? 0 : r.metrics.cost), 0);
      map.set(row.id, sum);
    }
    return map;
  }, [rows, perfPeriod, customFrom, customTo]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateInsight = async (row: AuditRowData) => {
    setLoadingInsights(prev => ({ ...prev, [row.id]: true }));
    const p = computePerf(row.campaignApiData);

    try {
      const { data, error } = await supabase.functions.invoke('audit-insight', {
        body: {
          campaignData: {
            campaignName: row.campaign_name,
            platform: row.platform,
            presupuestoTotal: row.presupuesto_total.toFixed(2),
            gastoActual: row.metrics.gastoActual.toFixed(2),
            presupuestoRestante: row.metrics.presupuestoRestante.toFixed(2),
            diasTranscurridos: row.metrics.diasTranscurridos,
            diasRestantes: row.metrics.diasRestantes,
            pacingStatus: row.metrics.pacingStatus,
            pacingPct: row.metrics.pacingPct.toFixed(1),
            gastoDiarioActual: row.metrics.gastoDiarioActual.toFixed(2),
            presupuestoDiarioIdeal: row.metrics.presupuestoDiarioIdeal.toFixed(2),
            ctr: p.ctr.toFixed(2),
            cpc: p.cpc.toFixed(2),
            impressions: p.impressions,
            clicks: p.clicks,
            reach: p.reach,
          },
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setInsights(prev => ({ ...prev, [row.id]: data as InsightData }));
    } catch (e) {
      toast.error('Error al generar el insight de IA');
      console.error(e);
    } finally {
      setLoadingInsights(prev => ({ ...prev, [row.id]: false }));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center text-muted-foreground">
        <p className="text-sm">Aún no hay campañas auditadas.</p>
        <p className="text-xs mt-1">Crea un nuevo registro para empezar a auditar.</p>
      </div>
    );
  }

  return (
    <>
      {/* View toggle: budget pacing vs performance results */}
      <div className="hidden md:flex items-center justify-between mb-2">
        <Tabs value={view} onValueChange={(v) => setView(v as 'pacing' | 'performance')}>
          <TabsList className="h-8">
            <TabsTrigger value="pacing" className="text-xs gap-1.5 h-6">
              <Gauge className="h-3.5 w-3.5" /> Ritmo de gasto
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1.5 h-6">
              <BarChart3 className="h-3.5 w-3.5" /> Rendimiento
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Select value={perfPeriod} onValueChange={(v) => setPerfPeriod(v as PerfPeriod)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERF_PERIOD_LABELS) as PerfPeriod[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{PERF_PERIOD_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {perfPeriod === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-[140px] text-xs" />
            </div>
          )}
        </div>
      </div>
      {perfPeriod !== 'all' && (
        <p className="hidden md:block text-[11px] text-muted-foreground mb-2 -mt-1">
          {view === 'pacing'
            ? `Gasto actual muestra el gasto de ${PERF_PERIOD_LABELS[perfPeriod]}. El % de ritmo se mantiene vs. el cronograma completo.`
            : `Métricas de rendimiento de ${PERF_PERIOD_LABELS[perfPeriod]}.`}
        </p>
      )}

      {/* Mobile: cards/accordions */}
      <div className="md:hidden space-y-3">
        {rows.map(row => {
          const m = row.metrics;
          const isExpanded = expandedIds.has(row.id);
          const insight = insights[row.id] || null;
          return (
            <Collapsible
              key={row.id}
              open={isExpanded}
              onOpenChange={() => toggleExpand(row.id)}
            >
              <div className={`border border-border rounded-lg bg-card overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <PlatformBadge platform={row.platform} />
                        <span className="text-sm font-semibold text-foreground truncate">{row.campaign_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {insight && <RiskIndicator insight={insight} />}
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={m.pacingStatus} />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {row.campaignApiData[0]?.account_name || row.account_id}
                      </span>
                    </div>
                    <PacingBar
                      porcentajeTiempo={m.porcentajeTiempo}
                      porcentajeGasto={m.porcentajeGastado}
                      status={m.pacingStatus}
                    />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <MetricMini label="Gasto" value={fmt(m.gastoActual)} />
                      <MetricMini label="Presupuesto" value={fmt(row.presupuesto_total)} />
                      <MetricMini label="% Esperado" value={fmtPct(m.porcentajeTiempo)} />
                      <MetricMini label="% Actual" value={fmtPct(m.porcentajeGastado)} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border p-3 space-y-3 bg-muted/20 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Fecha de inicio</p>
                        <Input type="date" value={row.fecha_inicio}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_inicio: e.target.value })}
                          className="h-8 text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Fecha de fin</p>
                        <Input type="date" value={row.fecha_fin}
                          onChange={e => onUpdateRecord?.(row.id, { fecha_fin: e.target.value })}
                          className="h-8 text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Cronograma</p>
                        <Select value={row.tipo_calendario}
                          onValueChange={v => onUpdateRecord?.(row.id, { tipo_calendario: v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corridos" className="text-xs">Todos los días</SelectItem>
                            <SelectItem value="lun_vie" className="text-xs">Lun–Vie</SelectItem>
                            <SelectItem value="lun_sab" className="text-xs">Lun–Sáb</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Presupuesto</p>
                        <Input type="number" value={row.presupuesto_total}
                          onChange={e => onUpdateRecord?.(row.id, { presupuesto_total: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs text-right font-mono" />
                      </div>
                    </div>
                    <ExpandedDetails
                      row={row}
                      insight={insight}
                      loadingInsight={loadingInsights[row.id] || false}
                      onGenerateInsight={() => generateInsight(row)}
                      period={perfPeriod}
                      customFrom={customFrom}
                      customTo={customTo}
                    />
                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-border" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/app/audit/${row.id}`} title="Ver detalles">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div ref={wrapperRef} className="hidden md:block relative">
        <HScroll className="border border-border rounded-lg">
        <table className={`w-full caption-bottom text-sm ${view === 'pacing' ? 'min-w-[1450px]' : 'min-w-[1350px]'}`}>
        <TableHeader>
          {view === 'pacing' ? (
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs">Plataforma</TableHead>
              <TableHead className="text-xs">Campaña</TableHead>
              <TableHead className="text-xs">Cuenta</TableHead>
              <TableHead className="text-xs w-[132px]">Fecha de inicio</TableHead>
              <TableHead className="text-xs w-[132px]">Fecha de fin</TableHead>
              <TableHead className="text-xs w-[110px]">Cronograma</TableHead>
              <TableHead className="text-xs w-[110px] text-right">
                Presupuesto programado
                <MetricInfo label="Presupuesto programado">
                  Presupuesto total aprobado para la campaña durante el período auditado.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Gasto actual
                <MetricInfo label="Gasto actual">
                  Gasto real reportado por la plataforma hasta ahora (excluye hoy y ayer mientras se consolidan los datos).
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                % Esperado
                <MetricInfo label="% de gasto esperado a la fecha">
                  Cuánto del presupuesto DEBERÍA estar gastado hoy si el ritmo fuera perfecto. Basado en días transcurridos vs. días totales del cronograma.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                % Actual
                <MetricInfo label="% de gasto actual a la fecha">
                  Cuánto del presupuesto se ha gastado REALMENTE. Verde = dentro de ±10% de lo esperado. Ámbar = por detrás (subgastando). Rojo = por delante (sobregastando).
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Ideal diario
                <MetricInfo label="Presupuesto diario ideal">
                  Saldo restante dividido entre los días que quedan. Gasta esto por día para terminar exactamente en presupuesto.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Restante
                <MetricInfo label="Saldo restante">
                  Presupuesto programado menos gasto actual.
                </MetricInfo>
              </TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs w-20"></TableHead>
            </TableRow>
          ) : (
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-xs">Plataforma</TableHead>
              <TableHead className="text-xs">Campaña</TableHead>
              <TableHead className="text-xs text-right">Impresiones</TableHead>
              <TableHead className="text-xs text-right">Alcance</TableHead>
              <TableHead className="text-xs text-right">Conversiones</TableHead>
              <TableHead className="text-xs text-right">Clics</TableHead>
              <TableHead className="text-xs text-right">Clics al enlace</TableHead>
              <TableHead className="text-xs text-right">Interacciones</TableHead>
              <TableHead className="text-xs text-right">
                CTR
                <MetricInfo label="Tasa de clics">Clics / impresiones × 100.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">Thruplay</TableHead>
              <TableHead className="text-xs text-right">
                CPM
                <MetricInfo label="Costo por mil">Costo por cada 1,000 impresiones.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                CPC
                <MetricInfo label="Costo por clic">Gasto total / clics.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs text-right">
                Interacción
                <MetricInfo label="Tasa de interacción">Interacciones / impresiones × 100.</MetricInfo>
              </TableHead>
              <TableHead className="text-xs w-20"></TableHead>
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const m = row.metrics;
            const p = perfByRow.get(row.id)!;
            const isExpanded = expandedIds.has(row.id);
            const insight = insights[row.id] || null;
            const colCount = 15;
            return (
              <Collapsible key={row.id} open={isExpanded} onOpenChange={() => toggleExpand(row.id)} asChild>
                <>
                  <CollapsibleTrigger asChild>
                    <TableRow className={`cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30'}`}>
                      <TableCell className="px-2">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell>
                        <PlatformBadge platform={row.platform} />
                      </TableCell>
                      <TableCell>
                        <HoverCard openDelay={200} closeDelay={80}>
                          <HoverCardTrigger asChild>
                            <span className="text-sm font-medium text-foreground truncate max-w-[180px] block cursor-help">
                              {row.campaign_name}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-72 p-3">
                            <CampaignSummary row={row} />
                          </HoverCardContent>
                        </HoverCard>
                      </TableCell>

                      {view === 'pacing' ? (
                        <>
                          <TableCell>
                            {(() => {
                              const apiRow = row.campaignApiData[0];
                              const name = apiRow?.account_name || row.account_id;
                              return <span className="text-xs text-muted-foreground">{name}</span>;
                            })()}
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Input
                              type="date"
                              value={row.fecha_inicio}
                              onChange={e => onUpdateRecord?.(row.id, { fecha_inicio: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Input
                              type="date"
                              value={row.fecha_fin}
                              onChange={e => onUpdateRecord?.(row.id, { fecha_fin: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Select
                              value={row.tipo_calendario}
                              onValueChange={v => onUpdateRecord?.(row.id, { tipo_calendario: v })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="corridos" className="text-xs">Todos los días</SelectItem>
                                <SelectItem value="lun_vie" className="text-xs">Lun–Vie</SelectItem>
                                <SelectItem value="lun_sab" className="text-xs">Lun–Sáb</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Input
                              type="number"
                              value={row.presupuesto_total}
                              onChange={e => onUpdateRecord?.(row.id, { presupuesto_total: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-xs text-right font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            <span className={m.pacingStatus === 'SOBREGASTANDO' && perfPeriod === 'all' ? 'text-destructive font-bold' : 'text-foreground'}>
                              {perfPeriod === 'all' ? fmt(m.gastoActual) : fmt(periodSpendByRow.get(row.id) ?? 0)}
                            </span>
                            {perfPeriod !== 'all' && (
                              <span className="block text-[9px] text-muted-foreground uppercase tracking-wide">período</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {fmtPct(m.porcentajeTiempo)}
                          </TableCell>
                          <TableCell className="text-right">
                            {perfPeriod === 'all'
                              ? <ActualPctCell actual={m.porcentajeGastado} expected={m.porcentajeTiempo} />
                              : <span className="font-mono text-xs text-foreground">
                                  {row.presupuesto_total > 0 ? fmtPct(((periodSpendByRow.get(row.id) ?? 0) / row.presupuesto_total) * 100) : '—'}
                                </span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {fmt(m.presupuestoDiarioIdeal)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-foreground">
                            {fmt(m.presupuestoRestante)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={m.pacingStatus} />
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.impressions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.reach)}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">{fmtNum(p.conversions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.clicks)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.linkClicks)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.interactions)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtPct(p.ctr)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtNum(p.thruplay)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(p.cpm)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmt(p.cpc)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{fmtPct(p.engagementRate)}</TableCell>
                        </>
                      )}

                      <TableCell className="text-right">
                        <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                          {insight && <RiskIndicator insight={insight} />}
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <Link to={`/app/audit/${row.id}`} title="Ver detalles">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(row.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleTrigger>
                  <CollapsibleContent asChild forceMount>
                    <tr className={isExpanded ? '' : 'hidden'}>
                      <td colSpan={colCount} className="p-0 bg-muted/20 border-t border-border">
                        <div
                          className="sticky left-0 animate-fade-in"
                          style={{ width: viewportWidth ? `${viewportWidth}px` : '100%' }}
                        >
                          <ExpandedDetails
                            row={row}
                            insight={insight}
                            loadingInsight={loadingInsights[row.id] || false}
                            onGenerateInsight={() => generateInsight(row)}
                            period={perfPeriod}
                            customFrom={customFrom}
                            customTo={customTo}
                          />
                        </div>
                      </td>
                    </tr>
                  </CollapsibleContent>
                </>
              </Collapsible>
            );
          })}
        </TableBody>
        </table>
        </HScroll>
      </div>
    </>
  );
}
