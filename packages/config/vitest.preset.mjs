import { defineConfig } from "vitest/config";

/**
 * 全パッケージ共通の Vitest 設定。
 * カバレッジ閾値を一元管理し、品質基準をリポジトリ全体で揃える。
 *
 * **`.ts` ではなく `.mjs` にしてある。** 各パッケージの `vitest.config.ts` から
 * `@platform/config/vitest` を import すると、vite はワークスペース外の依存として
 * **バンドルせず Node にそのまま渡す**。Node は `.ts` を読めないため
 * `ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".ts"` で
 * **全パッケージの設定読み込みが失敗する**(テストが 1 件も動かない)。
 *
 * 設定は素の JavaScript で足りるので、拡張子を変えるだけで解決する。
 */
export const basePreset = defineConfig({
  test: {
    globals: true,
    environment: "node",
    // **`.test.ts` だけを vitest が見る。** `.spec.ts` は Playwright(e2e)のもので、
    // 拾うと `Playwright Test did not expect test.describe() to be called here` で落ちる。
    // vitest の既定 include は `**/*.{test,spec}.?(c|m)[jt]s?(x)` なので、明示的に狭める。
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    // **`*.integration.test.ts` は通常実行から外す。** Docker(testcontainers)が要るため、
    // 手元や CI の通常ジョブでは起動できない。専用の `test:integration` で実行する。
    exclude: [
      "**/node_modules/**", "**/dist/**", "**/.next/**", "**/e2e/**",
      "**/*.integration.test.?(c|m)[jt]s?(x)",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});

export default basePreset;
