# @platform/loadtest

簡易負荷試験の基盤(純ロジック)。シナリオ定義・実行・レイテンシ統計を提供します。HTTP実行自体は fetch を注入するため、テストではモックできます。

- `scenario` … 重み付きリクエストシナリオ(`weightedPick`)
- `runner` … 並列ワーカーでの実行(`activeWorkers`)
- `stats` … `percentile` / `latencyStats` / `formatResult`(p50/p95/p99等)

```ts
import { latencyStats } from "@platform/loadtest";
const s = latencyStats(durationsMs);  // { p50, p95, p99, avg, max }
```

本番相当の大規模負荷には k6 等の専用ツールを推奨。本パッケージは開発中の「桁感の確認」用です。
