/**
 * 在庫の発注点割れから発注書ドラフトを起票する（アプリ側の組み合わせ）。
 * ロジックは @platform/purchase / @platform/inventory に委譲する。
 * @packageDocumentation
 */
import { buildPurchaseOrder, type PurchaseOrder, type PurchaseLine } from "@platform/purchase";
import { type StockStatus } from "./inventory-repo";

/** 発注ドラフト起票のオプション。 */
export interface ReorderDraftOptions {
  number: string;
  orderDate: string;
  supplier: string;
  dueDate?: string;
  /** 単価の既定（商品原価が不明なときの初期値）。既定 0。 */
  defaultUnitPrice?: number;
}

/** 発注が必要な商品だけを明細にした発注書ドラフトを作る。対象が無ければ undefined。 */
export function buildReorderPurchaseOrder(statuses: StockStatus[], options: ReorderDraftOptions): PurchaseOrder | undefined {
  const targets = statuses.filter((s) => s.needsReorder && s.suggestedOrderQty > 0);
  if (targets.length === 0) return undefined;
  const lines: PurchaseLine[] = targets.map((s) => ({ description: `${s.product.sku} ${s.product.name}`, quantity: s.suggestedOrderQty, unitPrice: options.defaultUnitPrice ?? 0 }));
  const header: { number: string; orderDate: string; supplier: string; dueDate?: string } = { number: options.number, orderDate: options.orderDate, supplier: options.supplier };
  if (options.dueDate !== undefined) header.dueDate = options.dueDate;
  return buildPurchaseOrder(header, lines);
}

/** 発注ドラフトの明細に対応する SKU 列（発注→入荷→在庫の連携に使う）。buildReorderPurchaseOrder と同じ絞り込み順。 */
export function reorderSkus(statuses: StockStatus[]): string[] {
  return statuses.filter((s) => s.needsReorder && s.suggestedOrderQty > 0).map((s) => s.product.sku);
}
