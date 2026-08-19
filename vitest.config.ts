/**
 * ルートの Vitest 設定。**カバレッジの設定だけ**を持つ。
 *
 * 【なぜルートに要るか】
 * `vitest.workspace.ts` を使うと、**カバレッジは全体で 1 つ**にまとめられる。
 * そのため各パッケージの `vitest.config.ts`(共通プリセット)に書いた
 * `coverage` は**使われず、ルート側の設定が採用される**。
 * 2026-08、`coverage-summary.json` が出ず `check-coverage` が
 * 永久に skip していたのはこれが理由。
 *
 * **テストの対象(projects)はここに書かない。** それは `vitest.workspace.ts` の役目。
 * 両方に書くと、どちらが効いているのか分からなくなる。
 *
 * 【なぜ `include` を絞るか】
 * 絞らないと、**生成物・設定ファイル・`tools/` まで分母に入る**。
 * 2026-08 の初回計測では、`apps/<アプリ>/src/generated/prisma` 配下(Prisma の生成物。
 * `.wasm-base64.js` まで)や `tools/smoke.mjs`(24,518 行)が数えられ、
 * 全体が **16%** と出た。この数字には 2 つの問題がある:
 *
 * 1. **意味が無い。** 生成物にテストを書くことはない
 * 2. **下限ラチェットが機能しない。** 検査を 1 本足すだけで割合が下がり、
 *    **テストを何も減らしていないのに CI が落ちる**
 *
 * さらに、生成物を読み込もうとして
 * `Failed to load source map for …/generated/prisma/runtime/*.js` が大量に出る。
 *
 * **測るのは「人が書いた実装」だけ。**
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // **`json-summary` を必ず出す。** `tools/check-coverage.mjs` が
      // これを読んで「前より下がっていないか」を判定する
      reporter: ["text", "html", "json-summary"],

      // **人が書いた実装だけ。** ここに無いものは分母にも入らない
      include: ["packages/*/src/**/*.{ts,tsx,mts}", "apps/*/src/**/*.{ts,tsx}"],

      exclude: [
        // テストそのもの
        "**/*.test.*",
        "**/*.spec.*",
        "**/__mocks__/**",
        "**/__fixtures__/**",
        // 型だけのファイル(実行される行が無い)
        "**/*.d.ts",
        // **生成物。** Prisma クライアント・自動生成の一覧など。
        // 直しようがないものを数えても、下限の意味が無い
        "**/generated/**",
        "**/*.generated.*",
        // 設定ファイル
        "**/*.config.*",
        // 画面の見た目そのもの(Next の枠組み。単体テストの対象にしていない)
        "apps/*/src/app/**/{layout,loading,not-found,error,global-error}.tsx",
      ],

      // **`all: true`(既定)のまま。**
      // テストが 1 本も無いファイルを 0% として数える。
      // これを false にすると「触っていないファイルは無かったこと」になり、
      // **テストを消すほど割合が上がる**という逆の動きをする。

      // **閾値はここに書かない。** 判定は `tools/check-coverage.mjs` が持つ
      // (下限ラチェット＋ core / crypto / guard だけ絶対値 80%)。
      // 理由は `packages/config/vitest.preset.mjs` の注記を参照。
    },
  },
});
