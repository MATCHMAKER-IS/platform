/**
 * パッケージが規約どおりの構成か検査する。
 *   node tools/check-package-shape.mjs
 *
 * scaffold を使わず手で作ると、tsconfig.json や scripts が欠けたまま紛れ込む。
 * 欠けていても**静かに素通り**するのが厄介で、`pnpm typecheck` を実行しても
 * そのパッケージだけ型チェックされない、という状態になる(実際に 14 件見つかった)。
 *
 * 検査項目:
 *   1. src/ を持つなら tsconfig.json がある
 *   2. build / typecheck / lint スクリプトがある
 *   3. テストファイルがあるなら test スクリプトがある
 *   4. README.md がある
 *
 * 例外(設定専用パッケージなど)は EXEMPT に理由付きで登録する。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

/** ランタイムコードを持たないパッケージ(検査対象外)。理由を残す。 */
const EXEMPT = {
  config: "共有ビルド設定パッケージ(ランタイムコードを持たない)",
};

/** src 配下の .ts を再帰的に集める。 */
function listSources(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export function check() {
  const pkgDir = path.join(ROOT, "packages");
  const issues = [];
  let checked = 0;

  for (const name of readdirSync(pkgDir)) {
    const dir = path.join(pkgDir, name);
    const pkgPath = path.join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    if (EXEMPT[name]) continue;
    checked += 1;

    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const scripts = pkg.scripts ?? {};
    const srcDir = path.join(dir, "src");
    const sources = existsSync(srcDir) ? listSources(srcDir) : [];
    const hasSource = sources.some((f) => !f.includes(".test."));
    const hasTest = sources.some((f) => f.includes(".test."));

    if (!hasSource) {
      issues.push(`${name}: src/ にソースがありません(空のパッケージ?)`);
      continue;
    }
    if (!existsSync(path.join(dir, "tsconfig.json"))) {
      issues.push(`${name}: tsconfig.json がありません(型チェック・ビルドが素通りします)`);
    }
    for (const key of ["build", "typecheck", "lint"]) {
      if (!scripts[key]) issues.push(`${name}: scripts.${key} がありません(pnpm ${key} で素通りします)`);
    }
    if (hasTest && !scripts.test) {
      issues.push(`${name}: テストファイルがあるのに scripts.test がありません`);
    }
    // テストがあるなら vitest.config.ts で共通プリセット(カバレッジ閾値)を使う
    if (hasTest && scripts.test?.includes("vitest") && !existsSync(path.join(dir, "vitest.config.ts"))) {
      issues.push(`${name}: vitest.config.ts がありません(共通のカバレッジ閾値が効きません)`);
    }
    // テストが無いのに vitest run すると「テストが見つからない」で失敗する
    if (!hasTest && scripts.test === "vitest run") {
      issues.push(`${name}: テストファイルが無いのに scripts.test="vitest run"(pnpm test が失敗します。--passWithNoTests を付けるか、テストを追加してください)`);
    }
    if (!existsSync(path.join(dir, "README.md"))) {
      issues.push(`${name}: README.md がありません`);
    }
  }
  return { checked, exempt: Object.keys(EXEMPT), issues };
}

function main() {
  const { checked, exempt, issues } = check();
  if (issues.length === 0) {
    console.log(`✅ パッケージ構成は規約どおり(${checked} 件検査 / 対象外 ${exempt.length} 件: ${exempt.join(", ")})`);
    return;
  }
  for (const i of issues) console.error(`❌ ${i}`);
  console.error(`\n${issues.length} 件の問題。scaffold(pnpm scaffold <name>)を使うと規約どおりの雛形が作れます。`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
