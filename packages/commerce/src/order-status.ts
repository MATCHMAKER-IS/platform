/**
 * 注文ステータスのライフサイクル(純ロジック)。
 * 未払い→支払い済み→処理中→発送→配達完了、およびキャンセル/返金の遷移可否を管理する。
 * 状態機械そのものは @platform/fsm、ここは EC の注文に特化した遷移定義。
 * @packageDocumentation
 */

/** 注文ステータス。 */
export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

/** 各ステータスから遷移可能なステータス。 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

/** 日本語のラベル。 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "未払い",
  paid: "支払い済み",
  processing: "処理中",
  shipped: "発送済み",
  delivered: "配達完了",
  cancelled: "キャンセル",
  refunded: "返金済み",
};

/** from → to の遷移が許されているか。 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** 次に遷移可能なステータス一覧。 */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

/** 終端(これ以上遷移しない)か。 */
export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/** キャンセル可能か。 */
export function isCancellable(status: OrderStatus): boolean {
  return canTransition(status, "cancelled");
}

/** 出荷済み(発送〜配達完了)か。 */
export function isShipped(status: OrderStatus): boolean {
  return status === "shipped" || status === "delivered";
}
