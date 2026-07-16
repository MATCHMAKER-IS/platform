/**
 * グラフ(チャート)UI 一式。recharts をラップし、統一オプション(タイトル・凡例・
 * グリッド・軸/単位・系列表示切替チェックボックス等)を備える。
 * @packageDocumentation
 */
export {
  CHART_COLORS, type SeriesDef, type BaseChartProps,
  SeriesToggle, useSeriesVisibility,
} from "./chart-common";
export { BarChart, LineChart, ComboChart, type CartesianChartProps } from "./cartesian";
export { PieChart, type PieChartProps } from "./pie-chart";
export { RadarChart, type RadarChartProps } from "./radar-chart";
export { ScatterChart, type ScatterChartProps, type ScatterSeries } from "./scatter-chart";
export { GanttChart, type GanttChartProps } from "./gantt-chart";
export { Heatmap, type HeatmapProps } from "./heatmap";
export { Treemap, type TreemapProps } from "./treemap";
export { FunnelChart, type FunnelChartProps } from "./funnel";
export { colorScale, interpolateColor } from "./color-scale";
export { ChartCard, type ChartCardProps } from "./chart-card";
export { CandlestickChart, type CandlestickChartProps, type Candlestick } from "./candlestick";
export { BubbleChart, type BubbleChartProps, type BubbleSeries } from "./bubble";
export { BandChart, Histogram, type BandChartProps, type HistogramProps } from "./band-histogram";
export { HorizontalBarChart } from "./cartesian";
export { WaterfallChart, type WaterfallChartProps } from "./waterfall";
export { SankeyChart, type SankeyChartProps } from "./sankey";
export { Gauge, ProgressRing, type GaugeProps, type ProgressRingProps } from "./gauge";
export { candleGeometry, toPercentStacked, histogramBins, toWaterfall, arcPath, polarToCartesian, ringDashOffset, type Candle, type HistBin, type WaterfallItem, type WaterfallRow } from "./chart-math";
export { toGanttRows, type GanttTask, type GanttRow } from "./gantt-transform";
