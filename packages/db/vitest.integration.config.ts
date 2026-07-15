import { defineConfig } from "vitest/config";

/**
 * 統合テスト用設定。testcontainers で実 PostgreSQL を起動するため
 * Docker が必要。CI では専用ジョブで実行する。
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
