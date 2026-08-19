import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * **実際に描いた画面**をアクセシビリティの観点で調べる。
 *
 * 【なぜ静的検査だけでは足りないか】
 * `check-a11y` はソースを読んで「`alt` を書いているか」「`onKeyDown` があるか」
 * を見ます。それはそれで有効ですが、**次のものは動かさないと分かりません**:
 *
 * | 見つかるもの | なぜ静的には無理か |
 * |---|---|
 * | **文字と背景のコントラスト不足** | CSS 変数とテーマの組み合わせで決まる。**計算しないと出ない** |
 * | ラベルと入力欄の**関連付け切れ** | `htmlFor` の綴り間違いは、DOM を組み立てて初めて分かる |
 * | 見出しの**階層飛ばし**(h1 → h3) | 部品が組み合わさった結果で決まる |
 * | ARIA 属性の**不正な組み合わせ** | 部品側の既定値と、渡した props の合成結果 |
 *
 * 【なぜ「重大なものだけ」に絞るか】
 * axe は 90 以上の規則を持ち、**全部を一度に緑にするのは現実的ではありません**。
 * 全部を課すと落ちたままになり、**止まった CI は無効化されます**
 * (カバレッジで同じ失敗をしています)。
 *
 * **`serious` と `critical` だけ**を落とす対象にしています——
 * この 2 つは「**使えない**」に直結するものです
 * (読めない・操作できない・スクリーンリーダーが読み上げない)。
 *
 * 【依存を 1 つ増やしている】
 * `@axe-core/playwright` は **開発時のみ**の依存で、本番の成果物には入りません。
 * 自前で実装できる種類のものではない(WCAG の規則そのもの)ため、
 * **有名なものをそのまま使う**方針(CLAUDE.md)に沿っています。
 */

/** 落とす対象。**「使えない」に直結するものだけ**。 */
const BLOCKING = ["serious", "critical"];

/**
 * 1 ページを調べて、重大な違反があれば失敗させる。
 *
 * @param page Playwright のページ
 * @param label 失敗時に出す画面の名前
 */
async function expectNoSeriousViolations(
  page: import("@playwright/test").Page,
  label: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    // **日本語の画面なので `lang` 関連は必ず見る。**
    // `lang` が無いと、読み上げが英語の発音になって聞き取れない
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter((v) => BLOCKING.includes(v.impact ?? ""));

  // **失敗したときに、直せる情報を出す。**
  // 「違反 3 件」だけでは、どこをどう直すか分からない
  const detail = serious
    .map((v) => {
      const where = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" / ");
      return `  [${v.impact}] ${v.id}: ${v.help}\n    該当: ${where}\n    詳細: ${v.helpUrl}`;
    })
    .join("\n");

  expect(serious.map((v) => v.id), `${label} に重大な問題があります:\n${detail}`).toEqual([]);
}

test.describe("アクセシビリティ(実際の画面を axe で調べる)", () => {
  test("showcase のトップ", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousViolations(page, "showcase トップ");
  });

  // **入力欄のある画面を必ず 1 つ入れる。**
  // ラベルの関連付け切れは、フォームでしか出ない
  test("showcase の問い合わせフォーム", async ({ page }) => {
    await page.goto("/inquiries");
    await expectNoSeriousViolations(page, "問い合わせフォーム");
  });

  // **crud-template は別ファイル(`a11y-crud.spec.ts`)に置いてある。**
  // 同じファイルに crud-template のポートを書くと、smoke の「E2E の行き先が実在するか」が
  // **ファイル単位で対象アプリを推定する**ため、showcase のパスを
  // crud-template 側で探して「存在しない」と誤判定する(2026-08)。
});
