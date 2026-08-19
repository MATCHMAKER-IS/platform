/**
 * 備品管理の最小 E2E(登録→貸出→返却)。
 *
 * **equipment-app から統合。** 独自ログインは無くなり、
 * internal-app のセッションを使う(開発では `/api/auth/dev-login`)。
 *
 * 注意: このスペックはオフライン開発環境では未実走。
 * CI 緑化後(docs/ops/GITHUB_ACTIONS.md)に動作確認すること。
 */
import { test, expect } from "@playwright/test";
import { hasApp, missingAppReason } from "./_apps";

test.use({ baseURL: "http://localhost:3000" });

// **このアプリが無い環境では飛ばす。** 基盤の CI には存在しない(ADR 0021)。
test.skip(!hasApp("internal-app"), missingAppReason("internal-app"));

test("備品を登録→貸出→返却できる", async ({ page }) => {
  const code = `E2E-${Date.now() % 1000000}`;

  // **ログインは internal-app 側。** 画面ごとのログインは持たない
  await page.goto("/api/auth/dev-login");
  await page.goto("/equipment");

  // 登録
  await page.getByLabel("コード").fill(code);
  await page.getByLabel("名称").fill("E2Eプロジェクター");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText(code)).toBeVisible();

  // 貸出
  const row = page.getByRole("row", { name: new RegExp(code) });
  await row.getByRole("button", { name: "貸出" }).click();
  await row.getByPlaceholder("借用者名").fill("山田");
  await row.getByRole("button", { name: "確定" }).click();
  await expect(row.getByText("貸出中: 山田")).toBeVisible();

  // 返却
  await row.getByRole("button", { name: "返却" }).click();
  await expect(row.getByText("在庫あり")).toBeVisible();
});
