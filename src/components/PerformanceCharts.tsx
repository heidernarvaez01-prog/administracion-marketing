import { useMemo } from 'react';
// Use the ESM build: the CJS `lib/core` entry resolves to a namespace object
// after Rollup interop in production builds, which React rejects (error #130).
import EChartsReactCore from 'echarts-for-react/esm/core';
import type { EChartsOption } from 'echarts';
import type { ApiCampaignRow } from '@/lib/api';
import { getTimeSeries } from '@/lib/metrics';
import { useChartTokens } from '@/lib/echarts-theme';
import { echarts } from '@/lib/echarts-setup';

function formatDateLabel(raw: string): string {
  // Try parsing different date formats
  let d: Date;
  // Handle DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
    const parts = raw.split('/');
    // Assume DD/MM/YYYY (common in Latin America)
    d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  } else {
    // ISO or other formats
    d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00');
  }
  if (isNaN(d.getTime())) return raw; // fallback to raw string
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

interface ChartDataPoint {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

interface Props {
  apiRows: ApiCampaignRow[];
  budget?: number;
  level?: 'campaign' | 'adset';
}

function buildChartData(rows: ApiCampaignRow[]): ChartDataPoint[] {
  // Aggregation math lives in the shared metrics layer; this just renames
  // cost→spend for the chart legend and formats the date label.
  return getTimeSeries(rows).map((point) => ({
    date: formatDateLabel(point.date),
    spend: point.cost,
    clicks: point.clicks,
    impressions: point.impressions,
    reach: point.reach,
    ctr: point.ctr,
    cpc: point.cpc,
    cpm: point.cpm,
  }));
}

const CHART_HEIGHT = 200;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 transition-all duration-200 hover:shadow-md hover:border-border/80 animate-fade-in">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="h-[200px] w-full">{children}</div>
    </div>
  );
}

export default function PerformanceCharts({ apiRows, budget, level = 'campaign' }: Props) {
  const data = useMemo(() => buildChartData(apiRows), [apiRows]);
  const tokens = useChartTokens();

  const cumulativeData = useMemo(() => {
    let acc = 0;
    return data.map(d => {
      acc += d.spend;
      return { ...d, cumulativeSpend: +acc.toFixed(2) };
    });
  }, [data]);

  // Two coherent token-based palettes so campaign vs. adset charts still
  // read as visually distinct, without ever hardcoding a raw hex value.
  const palette = level === 'campaign'
    ? { main: tokens.primary, second: tokens.secondary, third: tokens.success, fourth: tokens.warning }
    : { main: tokens.secondary, second: tokens.info, third: tokens.warning, fourth: tokens.success };

  const dates = useMemo(() => data.map(d => d.date), [data]);

  const baseOption = useMemo((): EChartsOption => ({
    textStyle: { fontFamily: 'inherit' },
    grid: { left: 44, right: 12, top: 28, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.card,
      borderColor: tokens.border,
      borderWidth: 1,
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,.08); border-radius: 8px;',
      textStyle: { color: tokens.foreground, fontSize: 11 },
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 10, color: tokens['muted-foreground'] },
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.border } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: tokens['muted-foreground'] },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens.border, type: 'dashed' } },
      axisLabel: { fontSize: 10, color: tokens['muted-foreground'] },
    },
  }), [dates, tokens]);

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-muted-foreground text-xs">
        Se necesitan al menos 2 días de datos para mostrar los gráficos.
      </div>
    );
  }

  const spendOption: EChartsOption = {
    ...baseOption,
    legend: { ...baseOption.legend, data: budget ? ['Gasto', 'Presupuesto'] : ['Gasto'] },
    series: [
      {
        name: 'Gasto',
        type: 'line',
        data: cumulativeData.map(d => d.cumulativeSpend),
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        lineStyle: { width: 2, color: palette.main },
        itemStyle: { color: palette.main },
      },
      ...(budget ? [{
        name: 'Presupuesto',
        type: 'line' as const,
        data: cumulativeData.map(() => budget),
        showSymbol: false,
        lineStyle: { width: 1.5, type: 'dashed' as const, color: tokens.destructive },
        itemStyle: { color: tokens.destructive },
      }] : []),
    ],
  };

  const performanceOption: EChartsOption = {
    ...baseOption,
    legend: { ...baseOption.legend, data: ['Clics', 'Impresiones', 'Alcance'] },
    series: [
      { name: 'Clics', type: 'line', data: data.map(d => d.clicks), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.main }, itemStyle: { color: palette.main } },
      { name: 'Impresiones', type: 'line', data: data.map(d => d.impressions), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.second }, itemStyle: { color: palette.second } },
      { name: 'Alcance', type: 'line', data: data.map(d => d.reach), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.third }, itemStyle: { color: palette.third } },
    ],
  };

  const efficiencyOption: EChartsOption = {
    ...baseOption,
    legend: { ...baseOption.legend, data: ['CTR %', 'CPC', 'CPM'] },
    series: [
      { name: 'CTR %', type: 'line', data: data.map(d => d.ctr), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.main }, itemStyle: { color: palette.main } },
      { name: 'CPC', type: 'line', data: data.map(d => d.cpc), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.fourth }, itemStyle: { color: palette.fourth } },
      { name: 'CPM', type: 'line', data: data.map(d => d.cpm), smooth: true, showSymbol: false, lineStyle: { width: 1.5, color: palette.third }, itemStyle: { color: palette.third } },
    ],
  };

  const dailySpendOption: EChartsOption = {
    ...baseOption,
    legend: { show: false },
    grid: { ...baseOption.grid, bottom: 8 },
    series: [
      {
        name: 'Gasto/día',
        type: 'line',
        data: data.map(d => d.spend),
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, color: palette.second },
        itemStyle: { color: palette.second },
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ChartCard title="Gasto acumulado">
        <EChartsReactCore echarts={echarts} option={spendOption} style={{ height: CHART_HEIGHT, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
      </ChartCard>

      <ChartCard title="Rendimiento (Clics · Impresiones · Alcance)">
        <EChartsReactCore echarts={echarts} option={performanceOption} style={{ height: CHART_HEIGHT, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
      </ChartCard>

      <ChartCard title="Eficiencia (CTR · CPC · CPM)">
        <EChartsReactCore echarts={echarts} option={efficiencyOption} style={{ height: CHART_HEIGHT, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
      </ChartCard>

      <ChartCard title="Gasto diario">
        <EChartsReactCore echarts={echarts} option={dailySpendOption} style={{ height: CHART_HEIGHT, width: '100%' }} opts={{ renderer: 'svg' }} notMerge />
      </ChartCard>
    </div>
  );
}
