import {
  describe, it, expect } from "vitest"; import { parseEnv, z, isProductionRuntime, appEnv, isProductionEnv, isDevEnv, isStagingEnv, appEnvLabel,
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

describe("空文字は未設定として扱う", () => {
  // **`.env` に `KEY=` と書くと空文字になる。** `z.string()` はそれを通すので、
  // 「設定した」つもりで空のまま本番へ出る。`.env.example` は空で配られるため、
  // **コピーしただけの状態がこれ**(2026-08 に対処)
  it("必須の項目が空文字なら落ちる", () => {
    expect(() => parseEnv(z.object({ TOKEN: z.string() }), { TOKEN: "" })).toThrow();
  });
  // **空白だけも同じ扱い。** 見た目では区別できない
  it("空白だけでも落ちる", () => {
    expect(() => parseEnv(z.object({ TOKEN: z.string() }), { TOKEN: "   " })).toThrow();
  });
  // **任意の項目は既定どおり動く。** undefined に寄せるので `.default()` が効く
  it("既定値がある項目は既定に落ちる", () => {
    const r = parseEnv(z.object({ MODE: z.string().default("sandbox") }), { MODE: "" });
    expect(r.MODE).toBe("sandbox");
  });
  it("任意の項目は未設定のまま通る", () => {
    const r = parseEnv(z.object({ NOTE: z.string().optional() }), { NOTE: "" });
    expect(r.NOTE).toBeUndefined();
  });
  // **値があるものは変えない**(境界)
  it("値があればそのまま", () => {
    const r = parseEnv(z.object({ TOKEN: z.string() }), { TOKEN: " abc " });
    expect(r.TOKEN).toBe(" abc ");
  });
});

// **`NODE_ENV` では検証と本番を見分けられない**(検証も本番と同じビルドで動かす)。
// そのための `APP_ENV`。ここが崩れると、検証から取引先へメールが飛ぶ
describe("appEnv", () => {
  it("APP_ENV をそのまま返す(production / staging)", () => {
    expect(appEnv({ APP_ENV: "production" })).toBe("production");
    expect(appEnv({ APP_ENV: "staging" })).toBe("staging");
  });

  // **知らない値は development に倒す。** 綴り間違い(`prod` / `stg`)で
  // **本番扱いになる**のが最も危ない
  it("未設定・不明な値は development", () => {
    expect(appEnv({})).toBe("development");
    expect(appEnv({ APP_ENV: "prod" })).toBe("development");
    expect(appEnv({ APP_ENV: "STAGING" })).toBe("development");
  });

  it("NODE_ENV=production でも APP_ENV が無ければ development", () => {
    expect(appEnv({ NODE_ENV: "production" })).toBe("development");
  });

  // **`isProductionRuntime` と役割が違う。** あちらは検証環境でも真になる
  it("isProductionEnv は APP_ENV だけを見る", () => {
    expect(isProductionEnv({ APP_ENV: "production" })).toBe(true);
    expect(isProductionEnv({ APP_ENV: "staging", NODE_ENV: "production" })).toBe(false);
    expect(isProductionRuntime({ APP_ENV: "staging", NODE_ENV: "production" })).toBe(true);
  });
});

// **検証環境と本番は見た目が同じ。** 「検証で試したつもりが本番だった」は実際に起きる
describe("環境の判定と表示", () => {
  it("APP_ENV が未設定なら開発", () => {
    expect(appEnv({})).toBe("development");
    expect(isDevEnv({})).toBe(true);
  });

  // **綴り違いは開発に倒す。** 本番の機能を誤って有効にしない
  it("知らない値は開発に倒す", () => {
    expect(appEnv({ APP_ENV: "prod" })).toBe("development");
    expect(appEnv({ APP_ENV: "STAGING" })).toBe("development");
    expect(isStagingEnv({ APP_ENV: "stg" })).toBe(false);
  });

  it("production / staging は正しく判定する", () => {
    expect(isStagingEnv({ APP_ENV: "staging" })).toBe(true);
    expect(isDevEnv({ APP_ENV: "production" })).toBe(false);
  });

  // **本番では帯を出さない。** 常時表示は読まれなくなる
  it("本番ではラベルを出さない", () => {
    expect(appEnvLabel({ APP_ENV: "production" })).toBeNull();
  });

  it("検証環境は警告色で目立たせる", () => {
    expect(appEnvLabel({ APP_ENV: "staging" })).toEqual({
      label: "検証環境（本番ではありません）", tone: "warning",
    });
  });
});
