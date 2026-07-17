/**
 * E2E テストの「壊れやすさ」を検査する。
 *   node tools/check-e2e-quality.mjs
 *
 * E2E は書き方次第で **たまに落ちる(Flaky)** テストになる。Flaky なテストは
 * 「また落ちた、再実行しよう」を生み、**やがて誰も CI を信じなくなる**。最悪の状態。
 *
 * 検出するもの:
 *   1. `waitForTimeout`(固定待ち) — 最大の Flaky 原因。速いマシンでは通り遅いマシンでは落ちる
 *   2. CSS セレクタ(`.btn-primary` `#submit`) — 見た目を変えると壊れる
 *   3. `retries` 未設定 — CI の揺らぎで即赤になる
 *   4. `trace` / `screenshot` 未設定 — 落ちたときに原因が分からない
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** E2E テストのあるディレクトリ。 */
const TEST_DIRS = ["e2e", "apps/internal-app/e2e"];
/** playwright 設定。 */
const CONFIGS = ["playwright.config.ts", "apps/internal-app/playwright.config.ts"];

function listSpecs(dir) {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => ({ rel: `${dir}/${f}`, body: readFileSync(path.join(full, f), "utf8") }));
}

export function check() {
  const issues = [];
  let specs = 0;

  // テストファイルの書き方
  for (const dir of TEST_DIRS) {
    for (const { rel, body } of listSpecs(dir)) {
      specs += 1;

      // 1. 固定待ち
      for (const m of body.matchAll(/waitForTimeout\((\d+)\)/g)) {
        issues.push({
          level: "error",
          message: `${rel}: waitForTimeout(${m[1]}) は固定待ちです。マシンの速さで結果が変わり Flaky になります。expect(...).toBeVisible() 等の「条件で待つ」に置き換えてください`,
        });
      }

      // 2. CSS セレクタ(見た目に依存)
      for (const m of body.matchAll(/locator\(\s*["'`]([.#][\w-]+)/g)) {
        issues.push({
          level: "warn",
          message: `${rel}: CSS セレクタ "${m[1]}" は見た目を変えると壊れます。getByRole / getByLabel / getByText を推奨`,
        });
      }

      // 3. 条件のない sleep
      if (/await new Promise\(\s*\(?r\)?\s*=>\s*setTimeout/.test(body)) {
        issues.push({
          level: "error",
          message: `${rel}: setTimeout での待機は固定待ちです。Flaky の原因になります`,
        });
      }
    }
  }

  // 設定
  for (const rel of CONFIGS) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) continue;
    const body = readFileSync(full, "utf8");
    if (!/retries\s*:/.test(body)) {
      issues.push({ level: "warn", message: `${rel}: retries が未設定です。CI の揺らぎで即赤になります(推奨: process.env.CI ? 2 : 0)` });
    }
    if (!/trace\s*:/.test(body)) {
      issues.push({ level: "warn", message: `${rel}: trace が未設定です。落ちたときに原因を追えません(推奨: "on-first-retry")` });
    }
    if (!/screenshot\s*:/.test(body)) {
      issues.push({ level: "warn", message: `${rel}: screenshot が未設定です(推奨: "only-on-failure")` });
    }
  }

  return { specs, issues };
}

function main() {
  const { specs, issues } = check();
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  if (issues.length === 0) {
    console.log(`✅ E2E は Flaky になりにくい書き方です(${specs} ファイル検査)`);
    return;
  }
  for (const i of errors) console.error(`❌ ${i.message}`);
  for (const i of warns) console.warn(`⚠️  ${i.message}`);
  if (errors.length > 0) {
    console.error("\nFlaky なテストは「また落ちた、再実行しよう」を生み、やがて誰も CI を信じなくなります。");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
