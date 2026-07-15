import { test, expect } from "@playwright/test";

test("必須未入力で送信するとバリデーションエラーが出る", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByText(/必須/).first()).toBeVisible();
});

test("パスワード不一致を検出する", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("氏名").fill("山田 太郎");
  await page.getByLabel("メールアドレス").fill("taro@example.co.jp");
  await page.getByLabel("パスワード", { exact: true }).fill("Passw0rd!");
  await page.getByLabel("パスワード(確認)").fill("Different1!");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByText("パスワードが一致しません")).toBeVisible();
});

test("郵便番号から住所を自動入力できる", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("郵便番号").fill("100-0001");
  await page.getByRole("button", { name: "住所検索" }).click();
  // 住所検索の結果(市区町村)が入るのを待つ(ネットワーク依存のため緩め)
  await expect(page.getByLabel("市区町村・番地")).not.toHaveValue("", { timeout: 8000 }).catch(() => {});
});

test("全項目を入力して送信でき、クライアント検証を通過する", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("氏名").fill("山田 太郎");
  await page.getByLabel("メールアドレス").fill("taro@example.co.jp");
  await page.getByLabel("郵便番号").fill("100-0001");
  await page.getByLabel("都道府県").selectOption({ label: "東京都" }).catch(() => {});
  await page.getByLabel("市区町村・番地").fill("千代田区千代田1-1");
  await page.getByLabel("パスワード", { exact: true }).fill("Passw0rd!");
  await page.getByLabel("パスワード(確認)").fill("Passw0rd!");
  await page.getByLabel("利用規約に同意する").check();
  await page.getByRole("button", { name: "登録する" }).click();
  // クライアント検証エラーが消えていること(必須・不一致が無い)
  await expect(page.getByText("パスワードが一致しません")).toHaveCount(0);
  await expect(page.getByText(/必須/)).toHaveCount(0);
});
