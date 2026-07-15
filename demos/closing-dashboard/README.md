# @demos/closing-dashboard — 決算ダッシュボード

月次の損益・消費税・貸借を `@platform/accounting` で集計し、`@platform/ui` の `KpiCard` / `DonutChart` で可視化。
仕訳CSV は `journalToRows`（accounting）→ `toCsv`（@platform/csv）→ `downloadCsv` でエクスポートします。
