/**
 * 在庫の入出庫台帳(純ロジック)。入庫/出庫/調整の履歴から現在庫を求める(監査可能）。
 * 発注入荷は inbound、売上出荷は outbound、棚卸差異は adjustment として記録する。
 * @packageDocumentation
 */

/** 入出庫の種別。 */
export type MovementType = "inbound" | "outbound" | "adjustment";

/** 1 件の入出庫。 */
export interface StockMovement {
  type: MovementType;
  /** 数量(inbound/outbound は正、adjustment は増減どちらも可）。 */
  quantity: number;
  /** 発生日時(ISO)。 */
  at: string;
  /** 参照(発注番号・出荷番号など）。 */
  ref?: string;
  /** 単価(在庫評価に使う。inbound で指定）。 */
  unitCost?: number;
}

/**
 * 入出庫の履歴から現在庫を計算する。
 *
 * **在庫数を直接持たず、履歴から毎回計算する**(イベントソーシング)。
 * 「なぜこの数になったのか」を後から追える。
 *
 * @param movements 入出庫の履歴
 * @returns 現在庫数(**マイナスもありうる**。データの不整合を隠さない)
 */
export function onHand(movements: StockMovement[]): number {
  return movements.reduce((qty, m) => {
    if (m.type === "inbound") return qty + m.quantity;
    if (m.type === "outbound") return qty - m.quantity;
    return qty + m.quantity; // adjustment は符号付き
  }, 0);
}

/** 入庫・出庫の合計。 */
export interface MovementSummary {
  totalIn: number;
  totalOut: number;
  adjustments: number;
  onHand: number;
}

/**
 * 入出庫の履歴を集計する。
 *
 * @param movements 入出庫の履歴
 * @returns 入庫合計・出庫合計・現在庫・件数
 */
export function summarize(movements: StockMovement[]): MovementSummary {
  let totalIn = 0, totalOut = 0, adjustments = 0;
  for (const m of movements) {
    if (m.type === "inbound") totalIn += m.quantity;
    else if (m.type === "outbound") totalOut += m.quantity;
    else adjustments += m.quantity;
  }
  return { totalIn, totalOut, adjustments, onHand: totalIn - totalOut + adjustments };
}

/**
 * 入出庫を追記する。**出庫が在庫を超えないか検証する**。
 *
 * **在庫より多く出庫できてしまうと、帳簿と現物が合わなくなる**。
 * 追記の時点で弾くことで、後から辻褄合わせをする手間を防ぐ。
 *
 * @param movements 既存の履歴
 * @param movement 追記する入出庫
 * @returns 追記した新しい履歴
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 出庫が現在庫を超える場合
 */
export function applyMovement(movements: StockMovement[], movement: StockMovement): { ok: boolean; movements: StockMovement[] } {
  if (movement.type === "outbound" && onHand(movements) < movement.quantity) {
    return { ok: false, movements };
  }
  return { ok: true, movements: [...movements, movement] };
}
