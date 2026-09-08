// Modular ECharts registration — only pulls in what the app actually renders
// (line charts, SVG renderer, grid/tooltip/legend) instead of the full
// `echarts` bundle (which ships every chart type, both renderers, and every
// component and adds ~275KB gzipped for features we don't use). Import this
// module's `echarts` export and pass it to `echarts-for-react`'s
// `EChartsReactCore` (from `echarts-for-react/core`, not the default export).
//
// Adding a new chart type later (e.g. a funnel/gauge chart) means adding its
// import here and to the `.use([...])` call below — nowhere else.
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export { echarts };
