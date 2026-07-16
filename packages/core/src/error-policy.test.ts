import { describe, it, expect } from "vitest";
import { httpStatusFor, isRetryable, toErrorEnvelope } from "./error-policy";
import { AppError, ErrorCode } from "./error";
describe("error policy", () => {
  it("maps status and retryability centrally", () => {
    expect(httpStatusFor(new AppError(ErrorCode.CONFLICT, "x"))).toBe(409);
    expect(httpStatusFor(new AppError(ErrorCode.EXTERNAL, "x"))).toBe(502);
    expect(httpStatusFor(new Error("raw"))).toBe(500);
    expect(isRetryable(new AppError(ErrorCode.DATABASE, "x"))).toBe(true);
    expect(isRetryable(new AppError(ErrorCode.VALIDATION, "x"))).toBe(false);
    expect(isRetryable(new Error("x"))).toBe(false);
  });
  it("builds envelope without leaking internals", () => {
    const env = toErrorEnvelope(new AppError(ErrorCode.NOT_FOUND, "なし", { details: { id: "1" } }), "t1");
    expect(env.error.code).toBe("NOT_FOUND");
    expect(env.error.traceId).toBe("t1");
    const raw = toErrorEnvelope(new Error("secret"));
    expect(raw.error.code).toBe("UNKNOWN");
    expect(JSON.stringify(raw)).not.toContain("secret");
  });
});
