// @ts-check
import boundaries from "eslint-plugin-boundaries";
import security from "eslint-plugin-security";

/**
 * リポジトリ全体の Lint ルール。
 *  1. boundaries: アプリ/デモ ↔ 基盤の境界を強制(公開 API 経由のみ、一方向依存)。
 *  2. security: 危険なパターン(evalインジェクション・安全でない乱数等)を静的検出。
 */
export default [
  security.configs.recommended,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "apps/*" },
        { type: "demo", pattern: "demos/*" },
        { type: "package", pattern: "packages/*" },
        { type: "tool", pattern: "tools/*" },
      ],
    },
    rules: {
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
