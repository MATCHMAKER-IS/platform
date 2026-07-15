/**
 * crud-template の最小 E2E(登録→編集→無効化→無効表示)。
 * 注意: このスペックはオフライン開発環境では未実走。CI 緑化後(docs/ops/CI_FIRST_RUN.md)に動作確認すること。
 */
import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:3002" });

test("品目の登録→編集→無効化→無効も表示 が一巡できる", async ({ page }) => {
  const code = `E2E-${Date.now() % 1000000}`;
  await page.goto("/");
  await page.getByLabel("コード").fill(code);
  await page.getByLabel("名称").fill("E2Eペン");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText(code)).toBeVisible();

  await page.getByRole("row", { name: new RegExp(code) }).getByRole("button", { name: "編集" }).click();
  const row = page.getByRole("row", { name: new RegExp(code) });
  await row.getByRole("textbox").first().fill("E2Eペン(赤)");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("E2Eペン(赤)")).toBeVisible();

  await page.getByRole("row", { name: new RegExp(code) }).getByRole("button", { name: "無効化" }).click();
  await expect(page.getByText(code)).toBeHidden();
  await page.getByLabel("無効も表示").check();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(code) }).getByText("無効")).toBeVisible();
});
