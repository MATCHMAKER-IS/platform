import { test, expect } from "@playwright/test";

test("トップページが表示され、共通UIが描画される", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /社内アプリ/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存する" })).toBeVisible();
});

test("ヘルスチェックが 200 を返す", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
});
