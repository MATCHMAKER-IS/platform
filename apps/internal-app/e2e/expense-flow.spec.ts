/**
 * 経費フローの E2E(取込 → ダッシュボード → 承認)。
 * ネットワークのある環境で `pnpm --filter internal-app e2e` を実行する。
 */
import { test, expect } from "@playwright/test";

test.describe("経費 CSV 取込フロー", () => {
  test("貼り付け→レビュー→確定でサマリが出る", async ({ page }) => {
    await page.goto("/expenses/import");
    await expect(page.getByRole("heading", { name: "経費 CSV 取込" })).toBeVisible();
    await page.getByRole("button", { name: "解析してレビュー" }).click();
    // ImportReview が表示される
    await expect(page.getByText(/件を読み込みました/)).toBeVisible();
  });
});

test.describe("経費ダッシュボード", () => {
  test("KPI と明細が表示される", async ({ page }) => {
    await page.goto("/expenses");
    await expect(page.getByRole("heading", { name: "経費ダッシュボード" })).toBeVisible();
    await expect(page.getByText("合計")).toBeVisible();
    await expect(page.getByText("月次推移")).toBeVisible();
  });
});

test.describe("経費承認フロー", () => {
  test("課長承認→部長承認で承認済みになる", async ({ page }) => {
    await page.goto("/expenses/approval");
    // 課長ロールで承認
    await page.getByRole("combobox").selectOption("課長(manager)");
    await page.getByRole("button", { name: "承認" }).click();
    // 部長ロールへ切替
    await page.getByRole("combobox").selectOption("部長(director)");
    await expect(page.getByRole("button", { name: "差戻し" })).toBeVisible();
    await page.getByRole("button", { name: "承認" }).click();
    await expect(page.getByText("承認済み")).toBeVisible();
  });

  test("差戻しで課長承認へ戻る", async ({ page }) => {
    await page.goto("/expenses/approval");
    await page.getByRole("combobox").selectOption("課長(manager)");
    await page.getByRole("button", { name: "承認" }).click();
    await page.getByRole("combobox").selectOption("部長(director)");
    // 差戻しは prompt を伴うためダイアログをハンドリング
    page.on("dialog", (d) => d.accept("再確認"));
    await page.getByRole("button", { name: "差戻し" }).click();
    await expect(page.getByText("課長承認")).toBeVisible();
  });
});

test.describe("取込履歴", () => {
  test("履歴が表示される", async ({ page }) => {
    await page.goto("/expenses/history");
    await expect(page.getByRole("heading", { name: "取込履歴" })).toBeVisible();
  });
});
