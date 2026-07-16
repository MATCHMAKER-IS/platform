/**
 * 複数倉庫の在庫(純ロジック)。倉庫別の在庫、倉庫間移動を扱う。
 * @packageDocumentation
 */
import { type StockMovement, onHand } from "./movements";

/** 倉庫を持つ入出庫。 */
export interface WarehouseMovement extends StockMovement {
  warehouse: string;
}

/** 倉庫ごとの在庫数。 */
export interface WarehouseStock {
  warehouse: string;
  onHand: number;
}

/**
 * 倉庫ごとの現在庫を集計する。
 *
 * @param movements 入出庫の履歴
 * @returns 倉庫 → 在庫数
 */
export function onHandByWarehouse(movements: WarehouseMovement[]): WarehouseStock[] {
  const groups = new Map<string, StockMovement[]>();
  const order: string[] = [];
  for (const m of movements) {
    if (!groups.has(m.warehouse)) {
      groups.set(m.warehouse, []);
      order.push(m.warehouse);
    }
    groups.get(m.warehouse)!.push(m);
  }
  return order.map((warehouse) => ({ warehouse, onHand: onHand(groups.get(warehouse)!) }));
}

/**
 * 全倉庫の合計在庫を返す。
 *
 * @param movements 入出庫の履歴
 * @returns 合計在庫数
 */
export function totalOnHand(movements: WarehouseMovement[]): number {
  return onHandByWarehouse(movements).reduce((s, w) => s + w.onHand, 0);
}

/**
 * 特定の倉庫の在庫を返す。
 *
 * @param movements 入出庫の履歴
 * @param warehouse 倉庫
 * @returns その倉庫の在庫数
 */
export function warehouseOnHand(movements: WarehouseMovement[], warehouse: string): number {
  return onHand(movements.filter((m) => m.warehouse === warehouse));
}

/**
 * 倉庫間移動を 2 件の入出庫（出庫元 outbound + 入庫先 inbound）に変換する。
 * 在庫不足なら null。
 *
 * **2 件セットで記録する**ことで、移動中に消えた在庫が無いことを保証できる
 * (出庫だけ記録して入庫を忘れる、という事故を防ぐ)。
 *
 * @param movements 既存の履歴
 * @param input 移動元・移動先・数量・日時
 * @returns 出庫と入庫の 2 件。**移動元の在庫が足りなければ null**
 */
export function transfer(
  movements: WarehouseMovement[],
  from: string,
  to: string,
  quantity: number,
  at: string,
): [WarehouseMovement, WarehouseMovement] | null {
  if (quantity <= 0 || warehouseOnHand(movements, from) < quantity) return null;
  return [
    { warehouse: from, type: "outbound", quantity, at, ref: `transfer:${to}` },
    { warehouse: to, type: "inbound", quantity, at, ref: `transfer:${from}` },
  ];
}
