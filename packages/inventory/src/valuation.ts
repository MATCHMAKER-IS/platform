/**
 * 在庫評価(移動平均法。純ロジック)。入庫のたびに平均単価を更新し、在庫金額を算出する。
 * @packageDocumentation
 */
import { type StockMovement } from "./movements";

/** 評価結果。 */
export interface Valuation {
  /** 現在庫数。 */
  onHand: number;
  /** 移動平均単価。 */
  averageCost: number;
  /** 在庫金額(現在庫 × 平均単価）。 */
  value: number;
  /**
   * **在庫より多く出庫した時点があったか。**
   *
   * 計算は止めずに続けるが(途中で例外にすると帳簿全体が読めなくなる)、
   * **記録に誤りがある**ことは伝える必要がある。
   *
   * 実務では普通に起きる——検品前に出荷を入力した、入庫の登録が漏れた、
   * 二重に出庫した。放置すると**在庫金額が 0 になり**(平均単価が算出できないため)、
   * 棚卸で差異が出たときに「出庫の記録ミス」だと分からない。
   *
   * `true` のときは**入出庫の記録を見直すこと**(2026-08 に追加)。
   */
  hadNegativeStock: boolean;
  /** 在庫がマイナスになった時点の日付(`at`)。記録を追う手がかり。 */
  negativeAt?: string;
}

/**
 * 移動平均法で在庫を評価する。
 * inbound: (既存金額 + 入庫数×入庫単価) / (既存数 + 入庫数) で平均単価更新。
 * outbound: その時点の平均単価で払い出す（金額 = 数量×平均単価を減算）。
 *
 * **仕入れ値が変動しても、在庫の評価額を一意に決められる**。
 * 「どのロットを売ったか」を追わなくてよいのが利点(FEFO の引当とは別の話)。
 *
 * @param movements 入出庫の履歴(**時系列の順**であること。順序が違うと平均単価がずれる)
 * @returns 在庫数・評価額・平均単価
 */
export function movingAverage(movements: StockMovement[]): Valuation {
  let qty = 0;
  let value = 0;
  let negativeAt: string | undefined;
  for (const m of movements) {
    if (m.type === "inbound") {
      value += m.quantity * (m.unitCost ?? 0);
      qty += m.quantity;
    } else if (m.type === "outbound") {
      const avg = qty > 0 ? value / qty : 0;
      value -= m.quantity * avg;
      qty -= m.quantity;
      // **在庫より多く出庫した時点を覚える。** 計算は止めない
      // (途中で例外にすると帳簿全体が読めなくなる)が、事実は返す
      if (qty < 0 && negativeAt === undefined) negativeAt = m.at;
    } else {
      // adjustment: 数量のみ増減（金額は現平均で調整）
      const avg = qty > 0 ? value / qty : 0;
      value += m.quantity * avg;
      qty += m.quantity;
    }
  }
  const averageCost = qty > 0 ? value / qty : 0;
  return { onHand: qty, averageCost: Math.round(averageCost * 100) / 100, value: Math.round(Math.max(0, value)) , hadNegativeStock: negativeAt !== undefined, ...(negativeAt !== undefined ? { negativeAt } : {}) };
}
