import { describe, it, expect } from "vitest";
import { resolveZone, shippingFeeForRegion, weightBasedFee, totalWeight } from "./shipping";
const zones = [
  { name: "本州", regions: ["東京都", "大阪府"], fee: 550, freeThreshold: 5000 },
  { name: "北海道・沖縄", regions: ["北海道"], fee: 1100, freeThreshold: 10000 },
];
describe("shipping", () => {
  it("computes region and weight fees", () => {
    expect(resolveZone(zones, "大阪府")!.name).toBe("本州");
    expect(shippingFeeForRegion(zones, "東京都", 3000)).toBe(550);
    expect(shippingFeeForRegion(zones, "東京都", 5000)).toBe(0);
    expect(shippingFeeForRegion(zones, "北海道", 5000)).toBe(1100);
    expect(shippingFeeForRegion(zones, "海外", 3000, 3000)).toBe(3000);
    const tiers = [{ maxWeight: 500, fee: 400 }, { maxWeight: 1000, fee: 600 }];
    expect(weightBasedFee(300, tiers)).toBe(400);
    expect(weightBasedFee(700, tiers)).toBe(600);
    expect(totalWeight([{ weight: 200, quantity: 2 }, { weight: 100, quantity: 3 }])).toBe(700);
  });
});
