import { basePreset } from "@platform/config/vitest";

/**
 * internal-app の Vitest 設定。
 *
 * **テスト用の環境変数をここで与える。** サーバ側のモジュールは読み込まれた時点で
 * `parseEnv` が走り、欠けていれば `CONFIG` エラーで落ちる(fail-fast)。
 * そのままでは単体テストが「環境変数の検証に失敗しました」で止まる。
 *
 * ここに並べるのは **`src/server/env.ts` で既定値を持たない項目**だけ。
 * 増やしたときは、このファイルにも足す必要がある。
 *
 * 値はダミーで構わない(このテストは DB にもメールサーバにも接続しない)。
 * **本番の値をここに書かないこと。**
 */
export default {
  ...basePreset,
  test: {
    ...basePreset.test,
    // **サーバ側モジュールの読み込みが重い。** `await import("./instrument")` が
    // observability・db・services などを連鎖的に読むため、既定の 5 秒では足りない
    // (実測 5.6 秒)。テストの中身が遅いのではなく、初回の読み込みが遅い。
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      MAIL_FROM: "test@example.com",
      SESSION_SECRET: "test-session-secret-for-unit-tests-only-32",
    },
  },
};
