/**
 * 在庫評価(移動平均法。純ロジック)。入庫のたびに平均単価を更新し、在庫金額を算出する。
 * @packageDocumentation
 */
import { type StockMovement } from "./movements.js";

/** 評価結果。 */
export interface Valuation {
  /** 現在庫数。 */
  onHand: number;
  /** 移動平均単価。 */
  averageCost: number;
  /** 在庫金額(現在庫 × 平均単価）。 */
  value: number;
}

/**
 * 移動平均法で在庫を評価する。
 * inbound: (既存金額 + 入庫数×入庫単価) / (既存数 + 入庫数) で平均単価更新。
 * outbound: その時点の平均単価で払い出す（金額 = 数量×平均単価を減算）。
 */
export function movingAverage(movements: StockMovement[]): Valuation {
  let qty = 0;
  let value = 0;
  for (const m of movements) {
    if (m.type === "inbound") {
      value += m.quantity * (m.unitCost ?? 0);
      qty += m.quantity;
    } else if (m.type === "outbound") {
      const avg = qty > 0 ? value / qty : 0;
      value -= m.quantity * avg;
      qty -= m.quantity;
    } else {
      // adjustment: 数量のみ増減（金額は現平均で調整）
      const avg = qty > 0 ? value / qty : 0;
      value += m.quantity * avg;
      qty += m.quantity;
    }
  }
  const averageCost = qty > 0 ? value / qty : 0;
  return { onHand: qty, averageCost: Math.round(averageCost * 100) / 100, value: Math.round(Math.max(0, value)) };
}
