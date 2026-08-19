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
      // **`json-summary` を必ず出す。** `tools/check-coverage.mjs` が
      // これを読んで「前より下がっていないか」を判定する。
      // 人が読む text/html だけだと、CI は何も判定できない。
      //
      // **ここに書いても効かない。** ワークスペース実行
      // (`vitest.workspace.ts`)では、カバレッジは**全体で 1 つ**なので
      // 設定は**ルートの `vitest.config.ts` が使われる**。
      // 対象の絞り込み(include / exclude)もあちらにある——**直すならあちら**。
      // ここに残してあるのは、パッケージ単体で
      // `pnpm --filter @platform/xxx test --coverage` と叩いたときのため。
      reporter: ["text", "html", "json-summary"],
      // **閾値はここに置かない。**
      //
      // 2026-08 まで `thresholds: { lines: 80, … }` と書いてあったが、
      // `--coverage` を一度も付けていなかったため**一度も評価されたことがない
      // 閾値**だった。実測は全体で約 11%(`ui` は 2%)なので、
      // そのまま有効にすると**ほぼ全パッケージが赤**になり、
      // 止まった CI は「とりあえず外す」で無効化される——結局何も守らなくなる。
      //
      // 判定は `tools/check-coverage.mjs` が持つ:
      //   - **下がったら落ちる**(下限ラチェット。`--set-floor` で引き上げる)
      //   - `core` / `crypto` / `guard` だけは**絶対値 80%**
      // 80% に届いたパッケージから、その `STRICT` へ移していく。
    },
  },
});

export default basePreset;
