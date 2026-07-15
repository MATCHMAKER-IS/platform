import { defineConfig } from "@playwright/test";

/**
 * E2E テスト設定。dev サーバーを起動して主要画面を検証する。
 * 実行: `pnpm --filter internal-app e2e`(UI モード: `pnpm --filter internal-app e2e -- --ui`)
 */
export default defineConfig({
  testDir: "./e2e",
  // CI は環境の揺らぎで稀に失敗するため 2 回まで再試行(手元では 0 = 失敗を隠さない)
  retries: process.env.CI ? 2 : 0,
  // 失敗時の調査材料。成功時は残さない(容量削減)
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
