import { describe, it, expect } from "vitest";
import { createSequencer, createMemorySequenceStore } from "./index.js";
describe("sequence", () => {
  it("pads and prefixes", async () => {
    const s = createSequencer(createMemorySequenceStore(), "inv", { prefix: "INV-", padding: 6 });
    expect(await s.next()).toBe("INV-000001");
    expect(await s.next()).toBe("INV-000002");
  });
  it("resets yearly and fiscally", async () => {
    const y = createSequencer(createMemorySequenceStore(), "o", { padding: 4, resetPeriod: "yearly" });
    expect(await y.next(new Date("2024-06-01"))).toBe("2024-0001");
    expect(await y.next(new Date("2025-01-05"))).toBe("2025-0001");
    const f = createSequencer(createMemorySequenceStore(), "s", { resetPeriod: "fiscalYearly", padding: 3 });
    expect(await f.next(new Date("2025-03-31"))).toBe("FY2024-001");
    expect(await f.next(new Date("2025-04-01"))).toBe("FY2025-001");
  });
});
