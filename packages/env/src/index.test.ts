import { describe, it, expect } from "vitest";
import { parseEnv, z } from "./index";
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
