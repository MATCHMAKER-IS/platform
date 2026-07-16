import { describe, it, expect } from "vitest";
import { createCircuitBreaker, CircuitOpenError } from "./circuit-breaker";
describe("circuit breaker", () => {
  it("opens after threshold, half-opens, closes", async () => {
    let clk = 0; const b = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100, successThreshold: 1, now: () => clk });
    const fail = async () => { throw new Error("x"); };
    for (let i = 0; i < 2; i++) { try { await b.execute(fail); } catch { /* ignore */ } }
    expect(b.state()).toBe("open");
    await expect(b.execute(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
    clk = 100;
    await b.execute(async () => 1);
    expect(b.state()).toBe("closed");
  });
});
