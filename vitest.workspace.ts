/**
 * Vitest ワークスペース。全パッケージ・アプリのテストをまとめて実行/検出する。
 *
 * ディレクトリではなく **設定ファイルそのものを指す**。
 * ディレクトリのパターンにすると `demos/README.md` のようなファイルにも当たり、
 * vitest がそれを設定として読もうとして
 * `No loader is configured for ".md" files` になる。
 * このとき全パッケージの設定が「読み込み失敗」になり、テストが 1 件も動かない。
 *
 * 設定ファイルを指す形なら、対象は必ず存在する設定だけになる。
 * 新しくテストを置くパッケージには vitest.config.ts も置くこと
 * (`node tools/check-test-setup.mjs` が確認する)。
 */
export default [
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
  "demos/*/vitest.config.ts",
];
