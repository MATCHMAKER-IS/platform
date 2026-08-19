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

describe("業務データの漏洩を防ぐ(既定のマスク対象)", () => {
  // **このパッケージの目的そのもの。** 認証情報は揃っていたが、
  // 2026-08 まで**業務データ**が抜けていた
  it("日本の業務で重いものを含む", () => {
    // マイナンバーは法律で扱いが厳しく、原則ログに残さない
    expect(DEFAULT_REDACT_PATHS).toContain("myNumber");
    // 口座情報(全銀ファイルの組み立てで実際に扱う)
    expect(DEFAULT_REDACT_PATHS).toContain("accountNumber");
    expect(DEFAULT_REDACT_PATHS).toContain("cardNumber");
    // 個人を特定できるもの
    expect(DEFAULT_REDACT_PATHS).toContain("address");
    expect(DEFAULT_REDACT_PATHS).toContain("birthDate");
  });
  // **入れ子でも隠す。** ログは `{ user: { address: ... } }` の形で出ることが多い
  it("入れ子のパスも対象にする", () => {
    for (const key of ["myNumber", "accountNumber", "address", "birthDate"]) {
      expect(DEFAULT_REDACT_PATHS).toContain(`*.${key}`);
    }
  });
  // **重複を作らない。** pino は同じパスを二度渡すとエラーになる
  it("重複が無い", () => {
    expect(new Set(DEFAULT_REDACT_PATHS).size).toBe(DEFAULT_REDACT_PATHS.length);
  });
});
