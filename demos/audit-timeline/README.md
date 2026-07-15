# @demos/audit-timeline — 監査ログのタイムライン可視化

`@platform/audit` の操作履歴を `@platform/ui` の `ActivityTimeline` で表示。操作ごとに点を色分け（承認=緑・却下=赤など）、
変更差分（before→after）を各行に表示します。`verifyChain` の結果を**改ざんなし/改ざん検知バッジ**で示します。

- `AuditTimelineScreen({ log, target })` — 全体 or 対象（`expense:1` 等）の履歴を時系列表示。
