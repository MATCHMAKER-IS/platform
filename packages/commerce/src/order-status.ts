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

/**
 * 注文ステータスの遷移が許されるかを判定する。
 *
 * **順序を飛ばせない**(未払いから出荷済みへは飛べない)。飛ばせると、
 * 決済していない注文を発送する事故が起きる。
 *
 * @param from 現在のステータス
 * @param to 変えたいステータス
 * @returns 許されるなら true
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * 次に遷移できるステータスを返す。
 *
 * **画面のボタンを出し分ける**のに使う。
 *
 * @param status 現在のステータス
 * @returns 遷移できるステータス
 */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

/**
 * 終端かを判定する(これ以上遷移しない)。
 *
 * @param status ステータス
 * @returns 終端なら true(配達完了・キャンセル)
 */
export function isFinalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

/**
 * キャンセルできるかを判定する。
 *
 * **出荷後はキャンセルできない**(返品の扱いになる)。
 *
 * @param status ステータス
 * @returns キャンセルできれば true
 */
export function isCancellable(status: OrderStatus): boolean {
  return canTransition(status, "cancelled");
}

/**
 * 出荷済みかを判定する(発送〜配達完了)。
 *
 * @param status ステータス
 * @returns 出荷済みなら true
 */
export function isShipped(status: OrderStatus): boolean {
  return status === "shipped" || status === "delivered";
}
