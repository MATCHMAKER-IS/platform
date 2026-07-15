/**
 * equipment-app の最小 E2E(ログイン→登録→貸出→返却)。
 * 注意: このスペックはオフライン開発環境では未実走。CI 緑化後(docs/ops/CI_FIRST_RUN.md)に動作確認すること。
 */
import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:3003" });

test("ログイン→備品登録→貸出→返却 が一巡できる", async ({ page }) => {
  const code = `E2E-${Date.now() % 1000000}`;
  await page.goto("/");

  // ログイン(初期ユーザー)
  await page.getByPlaceholder("初期: admin1234").fill("admin1234");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

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
