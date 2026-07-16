import { describe, it, expect } from "vitest";
import { withRetry } from "./resilient";
import { AppError, ErrorCode } from "@platform/core";
describe("retry uses central classification by default", () => {
  it("does not retry permanent errors, retries transient and raw", async () => {
    let permanent = 0;
    const ch1 = withRetry({ async send() { permanent++; throw new AppError(ErrorCode.VALIDATION, "x"); } }, { retries: 3, sleep: async () => {} });
    await expect(ch1.send({ text: "x" })).rejects.toBeInstanceOf(AppError);
    expect(permanent).toBe(1);
    let transient = 0;
    const ch2 = withRetry({ async send() { transient++; if (transient < 3) throw new AppError(ErrorCode.EXTERNAL, "x"); } }, { retries: 3, sleep: async () => {} });
    await ch2.send({ text: "x" });
    expect(transient).toBe(3);
    let raw = 0;
    const ch3 = withRetry({ async send() { raw++; if (raw < 2) throw new Error("ECONNRESET"); } }, { retries: 3, sleep: async () => {} });
    await ch3.send({ text: "x" });
    expect(raw).toBe(2);
  });
});
