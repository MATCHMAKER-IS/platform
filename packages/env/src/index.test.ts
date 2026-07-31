import {
  describe, it, expect } from "vitest"; import { parseEnv, z, isProductionRuntime,
} from "./index";
import { AppError } from "@platform/core";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

describe("parseEnv", () => {
  it("正しい値を型付きで返し、default を適用する", () => {
    const env = parseEnv(schema, { DATABASE_URL: "postgres://localhost/x" });
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("不正な値では CONFIG エラーで即失敗する", () => {
    try {
      parseEnv(schema, { DATABASE_URL: "not-a-url" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("CONFIG");
    }
  });
});

describe("isProductionRuntime(本番実行とビルドを区別する)", () => {
  it("開発・テストでは false", () => {
    expect(isProductionRuntime({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionRuntime({ NODE_ENV: "test" })).toBe(false);
    expect(isProductionRuntime({})).toBe(false);
  });

  it("本番で実行中なら true", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: "production", NEXT_PHASE: "phase-production-server" })).toBe(true);
  });

  it("**`next build` 中は false**(ビルドマシンに本番の秘密を置かせない)", () => {
    // NODE_ENV だけで判定すると、ビルドでもページデータ収集のために
    // env モジュールが読まれ、必須チェックで落ちる
    expect(isProductionRuntime({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
  });
});
