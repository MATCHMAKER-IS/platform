import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hasApp } from "./_apps";

/**
 * crud-template を axe で調べる。
 *
 * **showcase と分けてある。** smoke の「E2E の行き先が実在するか」は
 * **ファイル単位で対象アプリを推定**する(`localhost:3002` を含むかで判断)ため、
 * 1 つのファイルに両方のアプリを書くと**片方のパスを誤って探しに行きます**。
 *
 * **雛形なので、ここが緑であることに意味があります**——
 * `pnpm new-app` でコピーされた全アプリが、この状態から始まります。
 */
test("crud-template の一覧に重大な問題がない", async ({ page }) => {
  test.skip(!hasApp("crud-template"), "crud-template がこのチェックアウトにありません");
  await page.goto("http://localhost:3002/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  const detail = serious
    .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    詳細: ${v.helpUrl}`)
    .join("\n");
  if (serious.length > 0) throw new Error(`crud-template に重大な問題があります:\n${detail}`);
});
