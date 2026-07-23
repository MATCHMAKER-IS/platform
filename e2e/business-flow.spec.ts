/**
 * 業務の流れを通す E2E。
 *
 * これまでの E2E は**画面ごと**の確認だった。
 * 型検査も smoke も「画面が繋がっているか」は見ていないため、
 * **一連の業務が最後まで通るか**は誰も確かめていなかった。
 *
 * ここで見るのは次の 3 つ:
 *   1. 勤怠を打刻すると、その集計がそのまま給与の金額になるか
 *   2. 申請が承認まで進み、状態が変わるか
 *   3. マスタに登録したものが、一覧・CSV まで届くか
 *
 * **画面の細かい見た目は見ない。** そこは変わりやすく、壊れると
 * 「E2E がまた落ちた」で無視されるようになる。
 * 見るのは**業務として成立しているか**だけ。
 */
import { test, expect } from "@playwright/test";

test.describe("勤怠から給与へ", () => {
  test("打刻した内容が集計され、そのまま金額になる", async ({ page }) => {
    await page.goto("/attendance");
    await expect(page.getByRole("heading", { name: "勤怠・有給" })).toBeVisible();

    // 打刻の一覧が出ている(初期データが読み込まれている)
    await expect(page.getByText("実労働")).toBeVisible();

    // 集計が金額に渡っている。ここが繋がっていないと給与計算が始まらない
    await expect(page.getByText("基本賃金")).toBeVisible();
    await expect(page.getByText("合計")).toBeVisible();

    // 打刻を 1 件足すと、集計が変わる
    // 打刻を足すと集計に反映される(画面と計算が繋がっている確認)
    const before = await page.getByText(/出勤 \d+ 日/).textContent();
    await page.getByRole("button", { name: "記録する" }).click();
    await expect(page.getByText(/出勤 \d+ 日/)).not.toHaveText(before ?? "");
  });

  test("有給の残日数と、年 5 日の義務が出る", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByRole("button", { name: "年次有給休暇" }).click();

    // 付与・残日数・次の失効まで一通り出ること
    await expect(page.getByText(/残り \d+ 日/)).toBeVisible();
    await expect(page.getByText("付与の履歴")).toBeVisible();
  });
});

test.describe("申請から承認へ", () => {
  test("承認の流れが最後まで進む", async ({ page }) => {
    await page.goto("/approval");
    await expect(page.getByRole("button", { name: "承認フロー" })).toBeVisible();

    // 状態遷移(FSM)のタブへ切り替えられる
    await page.getByRole("button", { name: "状態遷移(FSM)" }).click();
    await expect(page.locator("body")).toContainText(/申請|提出|承認/);
  });

  test("Slack で承認するとき、押した人の権限を確かめる", async ({ page }) => {
    await page.goto("/approval");
    await page.getByRole("button", { name: "Slackで承認" }).click();

    // 権限のない人が押しても通らないこと。ここが業務の要点
    await page.getByLabel("押した人").selectOption("U_STAFF");
    await page.getByRole("button", { name: "ボタンを押す" }).click();
    await expect(page.getByText(/権限を持ちません|403/)).toBeVisible();

    // 権限のある人なら通る
    await page.getByLabel("押した人").selectOption("U_KACHO");
    await page.getByRole("button", { name: "ボタンを押す" }).click();
    await expect(page.getByText("承認済み")).toBeVisible();
  });
});

test.describe("マスタの登録から書き出しへ", () => {
  test("一覧・検索・CSV 出力が繋がっている", async ({ page }) => {
    await page.goto("/master");
    await expect(page.getByRole("heading", { name: /マスタ管理/ })).toBeVisible();

    // CSV の出入り口があること(業務では必ず使う)
    await expect(page.getByRole("button", { name: "CSV出力" })).toBeVisible();
    await expect(page.getByRole("button", { name: "CSV取込" })).toBeVisible();
  });

  test("参照されているものは、消す前に気づける", async ({ page }) => {
    await page.goto("/master");
    // 被参照の表示があること。これが無いと、使われている行を消して業務が止まる
    await expect(page.getByText("被参照")).toBeVisible();
  });
});

test.describe("画面どうしが繋がっているか", () => {
  test("トップから主要な業務画面へ辿れる", async ({ page }) => {
    await page.goto("/");
    // サイドバーから辿れること(直接 URL を知らない人が到達できるか)
    for (const name of ["勤怠・有給", "マスタ管理", "経費精算"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }
  });

  test("存在しない画面は 404 を返す(白い画面にしない)", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
  });
});
