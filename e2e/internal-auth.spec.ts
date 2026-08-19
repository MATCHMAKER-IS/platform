/**
 * ログイン・ログアウト・権限の E2E。
 *
 * 【なぜこれを書くか】
 * 2026-08 に見つけた穴は、いずれも**画面を開けば分かるもの**だった:
 * - ダッシュボードと監査が 404(`page.tsx` が無かった)
 * - ログイン画面にナビが出ていた
 * - ログアウトが `{"ok":true}` を表示していた
 *
 * smoke はコードの形しか見ないので、**実際に開いて確かめる層**が要る。
 *
 * 注意: このスペックはオフライン開発環境では未実走。
 * CI 緑化後(docs/ops/GITHUB_ACTIONS.md)に動作確認すること。
 */
import { test, expect } from "@playwright/test";
import { hasApp, missingAppReason } from "./_apps";

test.use({ baseURL: "http://localhost:3000" });

// **このアプリが無い環境では飛ばす。** 基盤の CI には存在しない(ADR 0021)。
test.skip(!hasApp("internal-app"), missingAppReason("internal-app"));

/** シードが入れる開発用の利用者。 */
const DEV_USER = { email: "dev@example.co.jp", password: "itsumo5963" };

test.describe("認証", () => {
  test("未ログインならログイン画面へ送られる", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/expenses");
    // **どの URL を開いてもログイン画面に来る**(中身が空の画面を見せない)
    await expect(page).toHaveURL(/\/login/);
  });

  test("ログイン画面にナビもチャットも出ない", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    // **まだ誰でもない状態でメニューを並べない**(押しても弾かれるだけ)
    await expect(page.getByRole("link", { name: "ダッシュボード" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "経費" })).toHaveCount(0);
  });

  test("ID とパスワードでログインできる", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(DEV_USER.email);
    await page.getByLabel("パスワード").fill(DEV_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();
    // **遷移を待つ。** クリック直後はまだ /login のまま
    // **`load` を待たない。** 遷移先(トップ)は定期更新を続けるので完了しない
    await page.waitForURL((u) => !u.pathname.startsWith("/login"),
      { timeout: 30_000, waitUntil: "domcontentloaded" });
    // ログイン後はナビが出る
    await expect(page.getByRole("link", { name: "ダッシュボード" })).toBeVisible();
  });

  test("失敗しても理由を区別しない", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    // **存在しないメール**と**間違ったパスワード**で、同じ文言が出ること。
    // 区別すると、登録済みのアドレスを総当たりで洗い出せる
    await page.getByLabel("メールアドレス").fill("nobody@example.co.jp");
    await page.getByLabel("パスワード").fill("wrong-password");
    await page.getByRole("button", { name: "ログイン" }).click();
    // **出るまで待つ。** 応答を待たずに読むと空になる
    await expect(page.getByRole("alert")).toBeVisible();
    const first = await page.getByRole("alert").textContent();

    await page.getByLabel("メールアドレス").fill(DEV_USER.email);
    await page.getByLabel("パスワード").fill("wrong-password");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    const second = await page.getByRole("alert").textContent();

    expect(first).toBe(second);
  });

  test("ログアウトするとログイン画面に戻る", async ({ page }) => {
    await page.goto("/api/auth/dev-login");
    await page.goto("/overview", { waitUntil: "domcontentloaded" });
    // **ナビが出るまで待つ。** `/api/auth/me` の応答を受けてから描かれる
    await expect(page.locator("nav button[aria-haspopup='menu']")).toBeVisible();
    // **アバターのボタンを開く。** 名前で探すと表示名に依存するので、
    // ナビの最下部にある「メニューを開く」役割の要素を使う
    await page.locator("nav button[aria-haspopup='menu']").first().click();
    await page.getByRole("menuitem", { name: "ログアウト" }).click();
    // **JSON を表示しない。** `{"ok":true}` が出るのは壊れて見える
    await page.waitForURL(/\/login/, { timeout: 30_000, waitUntil: "domcontentloaded" });
  });
});

test.describe("画面が開けること", () => {
  // **ナビに出ている先が 404 でないこと。**
  // `page.tsx` の付け忘れは、押すまで気づけない(2026-08 に 6 画面が該当)
  const PAGES = [
    "/dashboard", "/audit", "/chat", "/files", "/notifications",
    "/expenses", "/partners", "/equipment", "/balance", "/contracts",
    "/faq", "/surveys", "/reviews", "/board", "/approvals",
  ];

  // **1 つのテストでまとめて開く。**
  // 画面ごとにテストを分けると、並列で一斉にコンパイルを要求して
  // dev サーバが落ちる(2026-08、`ERR_CONNECTION_REFUSED` が 14 件)。
  // 順に開けば負荷が分散し、どの画面で落ちたかも分かる
  test("ナビの行き先がすべて開ける", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/api/auth/dev-login");

    const broken: string[] = [];
    for (const path of PAGES) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const status = res?.status() ?? 0;
      const notFound = await page.getByText("ページが見つかりません").count();
      if (status >= 400 || notFound > 0) broken.push(`${path}(${status})`);
    }
    // **まとめて報告する。** 1 つ目で止めると、残りの状態が分からない
    expect(broken, `開けない画面: ${broken.join(", ")}`).toEqual([]);
  });
});
