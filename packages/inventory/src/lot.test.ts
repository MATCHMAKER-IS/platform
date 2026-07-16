import { describe, it, expect } from "vitest";
import { lotBalances, expiringSoon, expiredLots, allocateFEFO, type LotMovement } from "./lot";
import { onHandByWarehouse, totalOnHand, transfer, warehouseOnHand, type WarehouseMovement } from "./warehouse";
describe("inventory lot", () => {
  const lots: LotMovement[] = [
    { lotId: "L1", type: "inbound", quantity: 100, at: "2025-07-01", expiry: "2025-08-31" },
    { lotId: "L2", type: "inbound", quantity: 50, at: "2025-07-02", expiry: "2025-07-20" },
    { lotId: "L1", type: "outbound", quantity: 30, at: "2025-07-05" },
    { lotId: "L3", type: "inbound", quantity: 80, at: "2025-07-03" },
  ];
  it("balances, expiry, FEFO", () => {
    expect(lotBalances(lots).find((l) => l.lotId === "L1")!.quantity).toBe(70);
    expect(expiringSoon(lots, "2025-07-15", 10).map((l) => l.lotId)).toEqual(["L2"]);
    expect(expiredLots(lots, "2025-08-01").some((l) => l.lotId === "L2")).toBe(true);
    const a = allocateFEFO(lots, 100);
    expect(a.allocations[0]!.lotId).toBe("L2");
    expect(a.shortfall).toBe(0);
    expect(allocateFEFO(lots, 300).shortfall).toBe(100);
  });
});
describe("inventory warehouse", () => {
  const wm: WarehouseMovement[] = [
    { warehouse: "東京", type: "inbound", quantity: 100, at: "a" },
    { warehouse: "大阪", type: "inbound", quantity: 50, at: "b" },
    { warehouse: "東京", type: "outbound", quantity: 30, at: "c" },
  ];
  it("per-warehouse and transfer", () => {
    expect(onHandByWarehouse(wm).find((w) => w.warehouse === "東京")!.onHand).toBe(70);
    expect(totalOnHand(wm)).toBe(120);
    const tr = transfer(wm, "東京", "大阪", 40, "2025-07-10")!;
    expect(tr[0]!.type).toBe("outbound");
    expect(warehouseOnHand([...wm, ...tr], "大阪")).toBe(90);
    expect(transfer(wm, "大阪", "東京", 100, "x")).toBeNull();
  });
});
