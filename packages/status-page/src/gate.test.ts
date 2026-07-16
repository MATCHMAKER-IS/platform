import { describe, it, expect } from "vitest";
import { createMaintenanceGate } from "./gate";
const now = () => new Date("2025-07-25T12:00:00Z");
describe("maintenance gate", () => {
  it("serves maintenance when enabled, bypasses health/static", () => {
    const g = createMaintenanceGate(() => ({ enabled: true }), now);
    expect(g.evaluate({ path: "/dashboard" }).active).toBe(true);
    expect(g.evaluate({ path: "/api/health" }).active).toBe(false);
    expect(g.evaluate({ path: "/_next/static/a.js" }).active).toBe(false);
  });
  it("off when disabled", () => {
    expect(createMaintenanceGate(() => ({ enabled: false }), now).evaluate({ path: "/x" }).active).toBe(false);
  });
  it("auto on/off by scheduled window", () => {
    expect(createMaintenanceGate(() => ({ window: { start: "2025-07-25T11:00:00Z", end: "2025-07-25T13:00:00Z" } }), now).evaluate({ path: "/x" }).active).toBe(true);
    expect(createMaintenanceGate(() => ({ window: { start: "2025-07-25T20:00:00Z", end: "2025-07-25T22:00:00Z" } }), now).evaluate({ path: "/x" }).active).toBe(false);
  });
  it("bypasses admins, allow-ips, bypass-header", () => {
    expect(createMaintenanceGate(() => ({ enabled: true, allowRoles: ["admin"] }), now).evaluate({ path: "/x", roles: ["admin"] }).active).toBe(false);
    expect(createMaintenanceGate(() => ({ enabled: true, allowIps: ["10.0.0.1"] }), now).evaluate({ path: "/x", ip: "10.0.0.1" }).active).toBe(false);
    expect(createMaintenanceGate(() => ({ enabled: true, bypassHeader: { name: "x-b", value: "s" } }), now).evaluate({ path: "/x", getHeader: () => "s" }).active).toBe(false);
  });
});

import { createAsyncMaintenanceGate, createMemoryMaintenanceStore, stateToConfig, createCachedConfig } from "./gate";
describe("maintenance gate (store/GUI toggle)", () => {
  const now = () => new Date("2025-07-25T12:00:00Z");
  it("toggles via store without restart", async () => {
    const store = createMemoryMaintenanceStore();
    const gate = createAsyncMaintenanceGate(() => stateToConfig(store.get(), { allowRoles: ["admin"] }), now);
    expect((await gate.evaluate({ path: "/x" })).active).toBe(false);
    store.set({ enabled: true, estimatedRecovery: "22:00" });
    expect((await gate.evaluate({ path: "/x" })).active).toBe(true);
    expect((await gate.evaluate({ path: "/x", roles: ["admin"] })).active).toBe(false);
    store.set({ enabled: false });
    expect((await gate.evaluate({ path: "/x" })).active).toBe(false);
  });
  it("caches config by TTL and dedupes", async () => {
    let calls = 0; let clock = 0;
    const cached = createCachedConfig(() => { calls++; return { enabled: false }; }, 5000, () => clock);
    await cached(); await cached();
    expect(calls).toBe(1);
    clock = 6000; await cached();
    expect(calls).toBe(2);
  });
});
