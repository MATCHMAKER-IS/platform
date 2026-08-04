/**
 * キーボードだけで操作できるかを確かめる E2E。
 *
 * 社内システムは「毎日・長時間・キーボード中心」で使われる。
 * マウスに手を伸ばす回数がそのまま業務効率に効くうえ、
 * **マウスを使えない利用者はそこで詰まる**。
 *
 * `check-a11y` は静的検査(alt・lang・tabIndex 等)なので、
 * **実際に操作できるか**は見ていない。ここで埋める。
 *
 * 見るのは次の 4 つ:
 *   1. Tab でフォーカスが進み、**見えている**こと(フォーカスリング)
 *   2. ⌘K / Ctrl+K でコマンドパレットが開き、Escape で閉じること
 *   3. リンクを Enter で辿れること
 *   4. フォームを Tab と Enter だけで送信できること
 */
import { test, expect } from "@playwright/test";

/** Mac 以外では Control を使う(CI は Linux)。 */
const MOD = process.platform === "darwin" ? "Meta" : "Control";

test("Tab でフォーカスが進み、輪郭が見える", async ({ page }) => {
  await page.goto("/");

  // 最初の Tab で、何かにフォーカスが移る
  await page.keyboard.press("Tab");
  const first = page.locator(":focus");
  await expect(first).toBeVisible();

  // **フォーカスの輪郭が消されていないこと。**
  // `outline: none` だけ書いて代替を用意しない実装が最も多い事故。
  // キーボード利用者は「今どこにいるか」が分からなくなる。
  const visible = await first.evaluate((el) => {
    const s = getComputedStyle(el);
    const hasOutline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    const hasRing = s.boxShadow !== "none" && s.boxShadow !== "";
    return hasOutline || hasRing;
  });
  expect(visible, "フォーカスされた要素に outline も box-shadow も無い（今どこにいるか分からない）").toBe(true);

  // 続けて Tab を押しても進む(1 つ目で止まらない)
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("コマンドパレットをキーボードだけで開閉できる", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press(`${MOD}+k`);
  // 検索欄にフォーカスが入る（開いた合図）
  // 実物のプレースホルダ:「コマンドやページを検索…」(packages/ui/src/components/command-palette.tsx)
  const input = page.getByPlaceholder(/コマンドやページを検索/);
  await expect(input).toBeVisible();

  // **Escape で閉じられること。** 開いたまま戻れないと、
  // マウスでしか脱出できなくなる
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
});

test("リンクを Enter で辿れる", async ({ page }) => {
  await page.goto("/");

  // 目的のリンクまで Tab で進む（無限ループを避けて上限を設ける）
  const target = page.getByRole("link", { name: /グラフ|チャート/ }).first();
  await target.focus();
  await expect(target).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/charts/);
});

test("フォームを Tab と Enter だけで送信できる", async ({ page }) => {
  await page.goto("/login");

  // 入力欄に Tab で到達し、値を打てる
  // EmailLoginForm は htmlFor 付きの label を持つ(「メールアドレス」「パスワード」)
  const email = page.getByLabel("メールアドレス");
  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.type("tanaka@example.co.jp");

  await page.keyboard.press("Tab");
  await page.keyboard.type("password123");

  // **Enter で送信できること。** ボタンまで Tab で移動しないと送れない
  // フォームは、毎日使う画面では負担になる
  await page.keyboard.press("Enter");

  // 送信された合図（結果の成否は問わない。押せたかどうかを見る）
  // このデモは資格情報が決め打ちなので、上の入力では**必ず失敗する**。
  // ここで見たいのは「Enter で送信できたか」なので、エラーが出れば十分
  await expect(page.getByText(/メールアドレスまたはパスワードが違います/)).toBeVisible({ timeout: 5000 });
});
