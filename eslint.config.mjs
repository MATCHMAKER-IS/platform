// @ts-check
import boundaries from "eslint-plugin-boundaries";
import security from "eslint-plugin-security";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * リポジトリ全体の Lint ルール。
 *  1. boundaries: アプリ/デモ ↔ 基盤の境界を強制(公開 API 経由のみ、一方向依存)。
 *  2. security: 危険なパターン(evalインジェクション・安全でない乱数等)を静的検出。
 *
 * 【`files` と parser がなぜ要るか】
 * **ESLint 9 は既定で `.js` 系しか対象にしない。**
 * `files` を書かないと TypeScript が 1 ファイルも lint されず、
 * `eslint src` は「all of the files matching the glob pattern "src" are ignored」で
 * **異常終了する**(2026-08 まで `pnpm lint` が動いていなかった)。
 *
 * また TS を読むにはパーサが要る。既定の espree は型注釈を解析できない。
 *
 * 【なぜ typescript-eslint の推奨ルールを入れないか】
 * 入れると 114 パッケージに大量の新規指摘が出る。
 * ここで守りたいのは**境界と危険なパターン**であって、書き方の統一ではない
 * (書き方は tsconfig の strict と 47 種の検査が見ている)。
 * 必要になったら段階的に足す。
 */
export default [
  {
    // 生成物と依存は見ない(数万行あり、直しようもない)
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/generated/**",
      "**/*.generated.ts",
      "docs/site/**",
    ],
  },
  security.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { boundaries, "react-hooks": reactHooks },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "apps/*" },
        { type: "demo", pattern: "demos/*" },
        { type: "package", pattern: "packages/*" },
        { type: "tool", pattern: "tools/*" },
      ],
    },
    rules: {
      // **`detect-object-injection` は切る。**
      // `obj[key]` を一律に警告するルールで、2026-08 の初回計測では
      // **約 500 件のうち 9 割以上**がこれだった。TypeScript では
      // `Record<string, T>` への型付きアクセスも同じ形なので、
      // ほぼすべてが誤検出になる。
      //
      // 「誤検出だらけの検査は無いより悪い」— 500 件の無視される警告は
      // 残り数十件の**本物(ReDoS・非リテラルなパス操作)を埋もれさせる**。
      //
      // プロトタイプ汚染の危険が消えるわけではない。**利用者の入力を
      // そのままキーにしない**(`__proto__` / `constructor` を弾く)ことは
      // 引き続き実装側の責任。
      "security/detect-object-injection": "off",

      // **`detect-unsafe-regex` も切る。**
      // 入れ子の量指定子を**形だけ**で判定するため、内側が排他的な文字クラスなら
      // 安全でも警告する。2026-08 に指摘された 10 件すべてを攻撃文字列で実測したが、
      // **全部が誤検出**だった(いずれも 1ms 未満で終わる)。
      //
      // 例: `^[a-z0-9]+(?:-[a-z0-9]+)*$` は内側にハイフンを含まないので
      //     分割の仕方が一意に決まり、バックトラックしない。
      //
      // **危険が無くなったわけではない。** 形ではなく**実測**で見張る:
      // smoke の「正規表現: 破滅的バックトラックが無いか」が、
      // 利用者の入力を受ける正規表現に攻撃文字列を与えて時間を測っている。
      // 新しく正規表現を足すときは、そこに 1 件足すこと。
      "security/detect-unsafe-regex": "off",

      // **フックの規則は error。** 条件分岐の中で呼ぶなどは確実にバグになる
      "react-hooks/rules-of-hooks": "error",
      // 依存配列の漏れは **warn**。意図して外す場面があり(初回だけ実行したい等)、
      // その場合は `// eslint-disable-next-line react-hooks/exhaustive-deps` と
      // **理由を添えて**外す。10 ファイルが既にその形で書かれていたが、
      // ルールが設定されておらず「存在しないルールの無効化」になっていた
      "react-hooks/exhaustive-deps": "warn",
      "boundaries/no-private": ["error", { allowUncles: false }],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "app", allow: ["package"] },
            { from: "demo", allow: ["package"] },
            { from: "package", allow: ["package"] },
            { from: "tool", allow: ["package", "app", "demo"] },
          ],
        },
      ],
    },
  },
];
