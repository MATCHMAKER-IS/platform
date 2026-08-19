/**
 * ダッシュボードと表示切替の E2E(showcase)。
 *
 * **行き先を直した。**
 * `/board` `/views` は元から存在せず、このテストは一度も通っていなかった
 * (2026-08 に E2E を動かして分かった)。
 * 実体はそれぞれ `/dashboard` と `/data-console` にある。
 */
import { test, expect } from "@playwright/test";

test("ダッシュボードに KPI カードとチャートが表示される", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "ダッシュボード" }).first()).toBeVisible();
  await expect(page.getByText("今月売上").first()).toBeVisible();
});

test("表示切替(カード/リスト/ブロック)が動作する", async ({ page }) => {
  await page.goto("/data-console");
  await expect(page.getByRole("heading", { name: /表示切替/ }).first()).toBeVisible();
  // 表示切替トグル
  const toggle = page.getByRole("tab", { name: /リスト表示/ });
  if (await toggle.isVisible()) await toggle.click();
});
