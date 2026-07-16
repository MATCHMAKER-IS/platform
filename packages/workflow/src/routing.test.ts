import { describe, it, expect } from "vitest";
import { resolveRoute, routeByAmount } from "./routing";
const mgr = { name: "課長", approverRole: "manager" };
const dir = { name: "部長", approverRole: "director" };
const exe = { name: "役員", approverRole: "executive" };
describe("routing", () => {
  it("resolves conditional route (first match wins)", () => {
    const rules = [{ when: (c: { dept: string }) => c.dept === "sales", steps: [mgr, dir] }, { steps: [mgr] }];
    expect(resolveRoute(rules, { dept: "sales" }).steps).toHaveLength(2);
    expect(resolveRoute(rules, { dept: "dev" }).steps).toHaveLength(1);
    expect(() => resolveRoute([{ when: () => false, steps: [mgr] }], {})).toThrow();
  });
  it("routes by amount tiers", () => {
    const tiers = [{ under: 100_000, steps: [mgr] }, { under: 1_000_000, steps: [mgr, dir] }, { steps: [mgr, dir, exe] }];
    expect(routeByAmount(50_000, tiers).steps).toHaveLength(1);
    expect(routeByAmount(100_000, tiers).steps).toHaveLength(2); // 境界
    expect(routeByAmount(5_000_000, tiers).steps).toHaveLength(3);
  });
});
