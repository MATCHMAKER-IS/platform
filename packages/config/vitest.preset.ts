import { defineConfig } from "vitest/config";

/**
 * 全パッケージ共通の Vitest 設定。
 * カバレッジ閾値を一元管理し、品質基準をリポジトリ全体で揃える。
 */
export const basePreset = defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});

export default basePreset;
