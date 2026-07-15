/**
 * 複数倉庫の在庫(純ロジック)。倉庫別の在庫、倉庫間移動を扱う。
 * @packageDocumentation
 */
import { type StockMovement, onHand } from "./movements.js";

/** 倉庫を持つ入出庫。 */
export interface WarehouseMovement extends StockMovement {
  warehouse: string;
}

/** 倉庫ごとの在庫数。 */
export interface WarehouseStock {
  warehouse: string;
  onHand: number;
}

/** 倉庫ごとの現在庫を集計する。 */
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

/** 全倉庫の合計在庫。 */
export function totalOnHand(movements: WarehouseMovement[]): number {
  return onHandByWarehouse(movements).reduce((s, w) => s + w.onHand, 0);
}

/** 特定倉庫の在庫。 */
export function warehouseOnHand(movements: WarehouseMovement[], warehouse: string): number {
  return onHand(movements.filter((m) => m.warehouse === warehouse));
}

/**
 * 倉庫間移動を 2 件の入出庫（出庫元 outbound + 入庫先 inbound）に変換する。
 * 在庫不足なら null。
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
