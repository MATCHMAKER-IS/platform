import { describe, it, expect } from "vitest";
import { onHand, summarize, applyMovement, type StockMovement } from "./movements";
import { allocateFEFO } from "./lot";
import { transfer } from "./warehouse";
import { reorderPoint, needsReorder, reorderQuantity } from "./reorder";
import { movingAverage } from "./valuation";
describe("inventory movements", () => {
  const mv: StockMovement[] = [
    { type: "inbound", quantity: 100, at: "2025-07-01", unitCost: 500 },
    { type: "outbound", quantity: 30, at: "2025-07-05" },
    { type: "inbound", quantity: 50, at: "2025-07-10", unitCost: 600 },
    { type: "adjustment", quantity: -5, at: "2025-07-15" },
  ];
  it("computes on-hand and summary", () => {
    expect(onHand(mv)).toBe(115);
    const s = summarize(mv);
    expect(s.totalIn).toBe(150);
    expect(s.totalOut).toBe(30);
    expect(s.onHand).toBe(115);
    expect(applyMovement([{ type: "inbound", quantity: 10, at: "x" }], { type: "outbound", quantity: 20, at: "y" }).ok).toBe(false);
  });
});
describe("inventory reorder & valuation", () => {
  const policy = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };
  it("reorder point and quantity", () => {
    expect(reorderPoint(policy)).toBe(55);
    expect(needsReorder(55, policy)).toBe(true);
    expect(reorderQuantity(30, policy)).toBe(80);
    expect(reorderQuantity(56, policy)).toBe(0);
  });
  it("moving average valuation", () => {
    const v = movingAverage([{ type: "inbound", quantity: 100, at: "a", unitCost: 500 }, { type: "outbound", quantity: 30, at: "b" }, { type: "inbound", quantity: 50, at: "c", unitCost: 600 }]);
    expect(v.onHand).toBe(120);
    expect(Math.abs(v.averageCost - 541.67)).toBeLessThan(0.01);
    expect(v.value).toBe(65000);
  });
});

describe("在庫より多く出庫したことを見逃さない", () => {
  const mv = (type: string, quantity: number, unitCost?: number) =>
    ({ id: "x", type, quantity, at: "2026-08-10", ...(unitCost !== undefined ? { unitCost } : {}) }) as never;

  // **実務では普通に起きる**——検品前に出荷を入力した、入庫の登録が漏れた、二重出庫。
  // 放置すると**在庫金額が 0 になり**、棚卸で差異が出ても原因が分からない(2026-08 に追加)
  it("在庫を超える出庫を記録する", () => {
    const r = movingAverage([mv("inbound", 10, 100), mv("outbound", 15)]);
    expect(r.hadNegativeStock).toBe(true);
    expect(r.negativeAt).toBe("2026-08-10");
    expect(r.onHand).toBe(-5);
  });
  // **計算は止めない。** 途中で例外にすると帳簿全体が読めなくなる
  it("マイナスでも結果は返る", () => {
    expect(movingAverage([mv("outbound", 5)]).onHand).toBe(-5);
  });
  // **正常なら付かない**(境界)
  it("在庫の範囲内なら記録しない", () => {
    const r = movingAverage([mv("inbound", 10, 100), mv("outbound", 5)]);
    expect(r.hadNegativeStock).toBe(false);
    expect(r.negativeAt).toBeUndefined();
  });
});

describe("期限切れロットを引き当てない", () => {
  const mv = (lotId: string, quantity: number, expiry: string) =>
    ({ id: lotId, type: "inbound", lotId, quantity, at: "2026-08-01", expiry }) as never;
  const movements = [mv("A", 10, "2026-08-05"), mv("B", 10, "2026-12-31"), mv("C", 10, "2026-09-30")];
  const now = new Date("2026-08-10T00:00:00Z");

  // **FEFO は「期限が近い順」なので、期限切れが最優先で選ばれる。**
  // 食品・医薬品・化学品では**出荷してはいけないものが出る**(2026-08 に対処)
  it("now を渡すと期限切れを除く", () => {
    const r = allocateFEFO(movements, 15, { now });
    expect(r.allocations.map((a) => a.lotId)).toEqual(["C", "B"]);
  });
  // **渡さなければ従来どおり**(既存の呼び出しに影響しない)
  it("now を渡さなければ全ロットが対象", () => {
    const r = allocateFEFO(movements, 15);
    expect(r.allocations[0]?.lotId).toBe("A");
  });
  // **足りない分は shortfall に出る**(期限切れを除いた結果として)
  it("期限切れを除いて足りなければ shortfall", () => {
    expect(allocateFEFO(movements, 25, { now }).shortfall).toBe(5);
  });
});

describe("倉庫間移動の入力を弾く", () => {
  const mv = [{ id: "1", type: "inbound", warehouse: "A", quantity: 50, at: "2026-08-01" }] as never;

  it("在庫の範囲内なら 2 件を返す", () => {
    expect(transfer(mv, "A", "B", 30, "2026-08-10")).toHaveLength(2);
  });
  // **在庫不足は通さない**(移動中に消えた在庫が生まれる)
  it("在庫を超えたら null", () => {
    expect(transfer(mv, "A", "B", 80, "2026-08-10")).toBeNull();
  });
  // **同じ倉庫への移動も通さない。** 在庫は変わらないのに履歴が 2 件増え、
  // 棚卸の突合で「なぜこの移動が?」と調べる手間になる。
  // 画面で from と to に同じ倉庫を選ぶのは普通に起きる(2026-08 に対処)
  it("移動元と移動先が同じなら null", () => {
    expect(transfer(mv, "A", "A", 10, "2026-08-10")).toBeNull();
  });
});
