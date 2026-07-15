# @demos/procure-to-pay — 商流統合（見積 → 発注 → 入荷 → 在庫 → 請求）

基盤パッケージのロジックだけで、B2B の一連の商流を通すオーケストレーション例。

| ステップ | 使う基盤 |
| --- | --- |
| 1. 見積 | `@platform/quote`（buildQuote / quoteStatus） |
| 2. 発注 | `@platform/purchase`（buildPurchaseOrder） |
| 3. 入荷・発注残 | `@platform/purchase`（receivingStatus / purchaseStatus） |
| 4. 在庫・評価・補充 | `@platform/inventory`（onHand / movingAverage / needsReorder / reorderQuantity） |
| 5. 請求・入金状態 | `@platform/quote`（convertToInvoice）+ `@platform/invoice`（paymentStatus） |

各ステップは純ロジックの合成のみ。金額計算は `@platform/tax` に一元化され、見積・発注・請求で一貫します。
入荷は在庫の入庫（inbound）として記録され、在庫評価（移動平均）と発注点による補充提案につながります。

## UI 画面（screen.tsx）
`ProcureToPayScreen` は上記フローを Steps + Card + StatCard + Badge で 1 画面に可視化します（見積→発注→入荷→在庫→請求を「次へ」で辿る）。
