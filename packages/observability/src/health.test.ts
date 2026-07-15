import { describe, it, expect } from "vitest";
import { runHealthChecks } from "./health.js";
describe("health", () => {
  it("aggregates up/down", async () => {
    const r = await runHealthChecks({ a: async () => true, b: async () => { throw new Error("x"); } });
    expect(r.status).toBe("unhealthy");
    expect(r.checks.find((c) => c.name === "b")!.status).toBe("down");
  });
});
