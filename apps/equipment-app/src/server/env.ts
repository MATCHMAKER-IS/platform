/**
 * 環境変数(crud-template と同パターン)。DATABASE_URL は PERSISTENCE=prisma のときのみ必須。
 * 秘密値は @platform/env の口を通し、本番では未設定を起動時に検出する(fail-fast)。
 * @packageDocumentation
 */
import { parseEnv, requireEnv, optionalEnv, assertSecretStrength, z } from "@platform/env";

export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().optional().describe("接続先 PostgreSQL(PERSISTENCE=prisma のとき必須)"),
  }),
);

/** 永続化モード。"prisma" で PostgreSQL、それ以外はインメモリ(開発用)。 */
export const usePrisma = optionalEnv("PERSISTENCE") === "prisma";

/**
 * サーバ専用の秘密値。開発では既定値で動くが、**本番では必須**(未設定なら起動時に CONFIG エラー)。
 * 既定の管理パスワードのまま本番公開する事故を防ぐ。
 */
function loadServerEnv(): { SESSION_SECRET: string; ADMIN_PASSWORD: string } {
  if (optionalEnv("NODE_ENV") === "production") {
    const required = requireEnv(["SESSION_SECRET", "ADMIN_PASSWORD"]);
    // "admin1234" のような既定値・短い鍵のまま本番公開する事故を防ぐ
    assertSecretStrength(required, { isProduction: true });
    return { SESSION_SECRET: required.SESSION_SECRET, ADMIN_PASSWORD: required.ADMIN_PASSWORD };
  }
  return {
    SESSION_SECRET: optionalEnv("SESSION_SECRET", "dev-secret-equipment-change-me"),
    ADMIN_PASSWORD: optionalEnv("ADMIN_PASSWORD", "admin1234"),
  };
}

export const serverEnv = loadServerEnv();
