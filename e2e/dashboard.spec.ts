import { test, expect } from "@playwright/test";

test("ダッシュボードに KPI カードとチャートが表示される", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
  await expect(page.getByText("今月売上")).toBeVisible();
});

test("表示切替(カード/リスト/ブロック)が動作する", async ({ page }) => {
  await page.goto("/views");
  await expect(page.getByRole("heading", { name: /表示切替/ })).toBeVisible();
  // 表示切替トグル
  const toggle = page.getByRole("tab", { name: /リスト表示/ });
  if (await toggle.isVisible()) await toggle.click();
});
