import { test, expect } from "@playwright/test";

test("トップページが表示され、主要デモへ遷移できる", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/./);
  // 索引にデモリンクが並ぶ
  await expect(page.getByRole("link", { name: /グラフ|チャート/ })).toBeVisible();
});

test("グラフページが描画される", async ({ page }) => {
  await page.goto("/charts");
  await expect(page.getByRole("heading", { name: /グラフ/ })).toBeVisible();
  // recharts は SVG を描画する
  await expect(page.locator("svg").first()).toBeVisible();
});
