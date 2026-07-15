/**
 * 軽量メトリクス(依存ゼロ)。カウンタ/ゲージ/ヒストグラムを集計し、
 * Prometheus テキスト形式で出力できる。
 * @packageDocumentation
 */

type Labels = Record<string, string>;
const keyOf = (name: string, labels?: Labels) => name + (labels && Object.keys(labels).length ? "|" + Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(",") : "");

interface HistogramState { buckets: Map<number, number>; sum: number; count: number }

/** メトリクスレジストリ。 */
export interface Metrics {
  incrementCounter(name: string, value?: number, labels?: Labels): void;
  setGauge(name: string, value: number, labels?: Labels): void;
  observeHistogram(name: string, value: number, labels?: Labels): void;
  /** Prometheus テキスト形式で出力。 */
  toPrometheus(): string;
  /** 素の値を取得(テスト用)。 */
  snapshot(): { counters: Record<string, number>; gauges: Record<string, number>; histograms: Record<string, { count: number; sum: number }> };
}

/** メトリクスレジストリを作る。 */
export function createMetrics(histogramBuckets: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500]): Metrics {
  const counters = new Map<string, number>();
  const gauges = new Map<string, number>();
  const histograms = new Map<string, HistogramState>();
  const nameOnly = new Map<string, string>();

  const remember = (key: string, name: string) => { if (!nameOnly.has(key)) nameOnly.set(key, name); };

  return {
    incrementCounter(name, value = 1, labels) { const k = keyOf(name, labels); counters.set(k, (counters.get(k) ?? 0) + value); remember(k, name); },
    setGauge(name, value, labels) { const k = keyOf(name, labels); gauges.set(k, value); remember(k, name); },
    observeHistogram(name, value, labels) {
      const k = keyOf(name, labels); remember(k, name);
      let h = histograms.get(k);
      if (!h) { h = { buckets: new Map(histogramBuckets.map((b) => [b, 0])), sum: 0, count: 0 }; histograms.set(k, h); }
      h.sum += value; h.count += 1;
      for (const b of histogramBuckets) if (value <= b) h.buckets.set(b, (h.buckets.get(b) ?? 0) + 1);
    },
    toPrometheus() {
      const lines: string[] = [];
      const labelStr = (k: string) => { const i = k.indexOf("|"); return i < 0 ? "" : "{" + k.slice(i + 1).split(",").map((p) => { const [a, b] = p.split("="); return `${a}="${b}"`; }).join(",") + "}"; };
      for (const [k, v] of counters) lines.push(`${nameOnly.get(k)}${labelStr(k)} ${v}`);
      for (const [k, v] of gauges) lines.push(`${nameOnly.get(k)}${labelStr(k)} ${v}`);
      for (const [k, h] of histograms) {
        const base = nameOnly.get(k); const ls = labelStr(k).replace(/}$/, "");
        for (const [b, c] of h.buckets) lines.push(`${base}_bucket${ls ? ls + "," : "{"}le="${b}"} ${c}`);
        lines.push(`${base}_sum${labelStr(k)} ${h.sum}`);
        lines.push(`${base}_count${labelStr(k)} ${h.count}`);
      }
      return lines.join("\n") + "\n";
    },
    snapshot() {
      return {
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        histograms: Object.fromEntries([...histograms].map(([k, h]) => [k, { count: h.count, sum: h.sum }])),
      };
    },
  };
}
