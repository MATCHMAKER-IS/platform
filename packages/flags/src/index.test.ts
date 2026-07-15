import { describe, it, expect } from "vitest";
import { evaluateFlag, selectVariant, createFlags, createStaticProvider } from "./index.js";
describe("feature flags", () => {
  it("kill switch, rollout, targeting", () => {
    expect(evaluateFlag(false)).toBe(false);
    expect(evaluateFlag({ enabled: false, rolloutPercent: 100 })).toBe(false);
    expect(evaluateFlag({ rolloutPercent: 100 }, { key: "u" }, "f")).toBe(true);
    expect(evaluateFlag({ rolloutPercent: 0 }, { key: "u" }, "f")).toBe(false);
    expect(evaluateFlag({ allow: [{ role: "admin" }], rolloutPercent: 0 }, { attributes: { role: "admin" } })).toBe(true);
    expect(evaluateFlag({ deny: [{ role: "x" }] }, { attributes: { role: "x" } })).toBe(false);
  });
  it("deterministic rollout ~50%", () => {
    let on = 0; for (let i = 0; i < 1000; i++) if (evaluateFlag({ rolloutPercent: 50 }, { key: `u${i}` }, "f")) on++;
    expect(on).toBeGreaterThan(400); expect(on).toBeLessThan(600);
  });
  it("variants deterministic", () => {
    const rule = { variants: [{ name: "A", weight: 50 }, { name: "B", weight: 50 }] };
    const v = selectVariant(rule, { key: "u1" }, "e");
    expect(selectVariant(rule, { key: "u1" }, "e")).toBe(v);
  });
  it("undefined flags are false", async () => {
    const f = createFlags(createStaticProvider({ a: true }));
    expect(await f.isEnabled("a")).toBe(true);
    expect(await f.isEnabled("missing")).toBe(false);
  });
});
