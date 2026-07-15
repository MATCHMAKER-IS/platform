/**
 * 在庫のアプリ層サービス(基盤 @platform/inventory の合成)。
 * @packageDocumentation
 */
import { onHand, summarize, movingAverage, needsReorder, reorderQuantity, lotBalances, expiringSoon, onHandByWarehouse, type StockMovement, type LotMovement, type WarehouseMovement, type ReorderPolicy } from "@platform/inventory";

/** 品目の在庫サマリ(現在庫・評価・補充要否)。 */
export function itemSummary(movements: StockMovement[], policy: ReorderPolicy) {
  const qty = onHand(movements);
  return { ...summarize(movements), valuation: movingAverage(movements), needsReorder: needsReorder(qty, policy), suggested: reorderQuantity(qty, policy) };
}

/** 期限管理: 期限切れ間近のロット。 */
export function expiryAlerts(movements: LotMovement[], asOf: string, days = 30) {
  return { lots: lotBalances(movements), expiringSoon: expiringSoon(movements, asOf, days) };
}

/** 倉庫別在庫。 */
export function warehouseSummary(movements: WarehouseMovement[]) {
  return onHandByWarehouse(movements);
}
