import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * E2E の対象になりうるアプリ(名前 → ポート)。
 *
 * **ここに並べただけでは起動しない。** 実際に `apps/<名前>/` が存在するものだけを
 * `webServer` に載せる({@link presentApps})。
 *
 * 【なぜ存在確認が要るか】
 * `.gitignore` が `apps/*` を除外しているため(ADR 0021)、
 * **基盤のリポジトリには showcase と crud-template しか無い**。
 * 2026-08 まで 4 アプリを固定で並べており、基盤の CI では
 * `cwd: "apps/internal-app"` が存在せず、**E2E が必ず失敗する**状態だった
 * (`continue-on-error: true` で緑に見えていたので、誰も気づけなかった)。
 *
 * この形なら、手元(5 アプリ)・基盤の CI(2 アプリ)・
 * アプリ側リポジトリの CI(基盤 + そのアプリ 1 つ)のどれでも同じ設定で動く。
 */
const E2E_APPS: readonly { name: string; port: number }[] = [
  { name: "internal-app", port: 3000 },
  { name: "showcase", port: 3001 },
  { name: "crud-template", port: 3002 },
  { name: "line-console", port: 3003 },
];

/** 実際に置かれているアプリだけを返す。 */
const presentApps = E2E_APPS.filter((a) => existsSync(path.join(ROOT, "apps", a.name, "package.json")));

/**
 * E2E テスト設定。showcase デモを自動起動して検証する。
 * 実行: `pnpm e2e`(初回は `pnpm exec playwright install` でブラウザ取得)。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,

  // **並列度を絞る。**
  // 既定は CPU 数(手元では 10)。dev サーバは 1 プロセスなので、
  // 10 本が同時に**初回コンパイルを要求すると耐えられず落ちる**
  // (2026-08、`ERR_CONNECTION_REFUSED` が 14 件出た)。
  // 本番ビルドなら問題ないが、手元は dev なのでここで抑える。
  workers: process.env.CI !== undefined ? 4 : 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  // **既定の 30 秒では足りない。**
  // dev サーバは**初回アクセス時にその画面をコンパイルする**ので、
  // 最初の `page.goto` に数十秒かかる(2026-08、23 件がこれで落ちた)。
  // 本番ビルドなら不要だが、手元では dev で走らせるためここを広げる。
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  // **前提の確認はここではしない。**
  // `globalSetup` は `webServer` の**後**に走るのでサーバ起動の失敗を防げず、
  // さらに Playwright はこれを CommonJS として読むため
  // `.ts` の中で `import.meta` が使えない(2026-08 に両方踏んだ)。
  // 確認は `pnpm e2e` の入口(tools/e2e.mjs)で行う。

  // **一覧は E2E_APPS に置き、実在するものだけを起動する。**
  // 実在しないアプリを指していないかは smoke も見張る
  // (2026-08、統合で消えた equipment-app / platform-portal が残っていた)。
  // **アプリのディレクトリで起動する。**
  // ルートから `--filter` で呼ぶと cwd がルートのままになり、
  // Next が `.env` を見つけられない(2026-08、環境変数の検証で落ちた)。
  webServer: presentApps.map((app) => ({
    command: "pnpm dev",
    cwd: `apps/${app.name}`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })),
});
