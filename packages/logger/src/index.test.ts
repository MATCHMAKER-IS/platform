import { describe, it, expect } from "vitest";
import { createLogger, DEFAULT_REDACT_PATHS } from "./index";

describe("createLogger", () => {
  it("Logger インターフェースを返す", () => {
    const log = createLogger({ level: "debug" });
    expect(typeof log.info).toBe("function");
    expect(typeof log.child).toBe("function");
  });

  it("child は Logger を返す", () => {
    const log = createLogger();
    expect(typeof log.child({ requestId: "r1" }).info).toBe("function");
  });

  it("既定マスキング対象に email/token が含まれる", () => {
    expect(DEFAULT_REDACT_PATHS).toContain("email");
    expect(DEFAULT_REDACT_PATHS).toContain("token");
  });

  it("info 呼び出しが例外を投げない", () => {
    const log = createLogger();
    expect(() => log.info({ userId: 1, email: "a@b.c" }, "ok")).not.toThrow();
  });
});
