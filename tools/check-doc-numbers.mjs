/**
 * 手書きドキュメントに書かれた数値が実態とズレていないか検査する。
 *   node tools/check-doc-numbers.mjs
 *
 * 自動生成物は check-generated.mjs が守るが、CLAUDE.md や architecture.md のような
 * **手書き**の資料は放置すると古くなる。AI(Claude Code 等)はこれを読んで前提にするため、
 * 「96 パッケージ」のような古い数値は誤った判断を生む。ここで機械的に検出する。
 *
 * 検査するのは「実態を数えれば分かる数値」だけ。文章の正しさは扱わない。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 実測値を集める。 */
export function measure() {
  const pkgDir = path.join(ROOT, "packages");
  const packages = readdirSync(pkgDir).filter((d) => existsSync(path.join(pkgDir, d, "package.json")));
  const readmes = packages.filter((d) => existsSync(path.join(pkgDir, d, "README.md")));
  const appDir = path.join(ROOT, "apps");
  const apps = readdirSync(appDir).filter((d) => existsSync(path.join(appDir, d, "package.json")));
  const demoDir = path.join(ROOT, "demos");
  const demoDirs = existsSync(demoDir) ? readdirSync(demoDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
  // dev スクリプトを持つ = 起動できるアプリ型。持たない = コンポーネント型(読むためのもの)
  let runnableDemos = 0;
  for (const d of demoDirs) {
    const p = path.join(demoDir, d, "package.json");
    if (!existsSync(p)) continue;
    if (JSON.parse(readFileSync(p, "utf8")).scripts?.dev) runnableDemos += 1;
  }
  return {
    packages: packages.length,
    readmes: readmes.length,
    apps: apps.length,
    demos: demoDirs.length,
    runnableDemos,
    componentDemos: demoDirs.length - runnableDemos,
  };
}

/**
 * 検査ルール。file の中の pattern が実測値と一致するかを見る。
 * pattern は「数値部分を (\d+) で captureする正規表現」。
 */
const RULES = [
  { file: "CLAUDE.md", pattern: /(\d+)\s*パッケージのカテゴリ別インデックス/, expect: (m) => m.packages, label: "CLAUDE.md のパッケージ数" },
  // 統合により demos は 1 サイトのみ(以前の「コンポーネント型 26」は showcase に取り込み済み)
  { file: "demos/README.md", pattern: /\*\*統合デモサイト\*\*\s*\|\s*\*\*(\d+)\*\*/, expect: (m) => m.demos, label: "demos/README.md の統合デモサイト数" },
  { file: "CLAUDE.md", pattern: /個別パッケージの用途・使い方\((\d+)\/(\d+) 整備済み\)/, expect: (m) => m.readmes, label: "CLAUDE.md の README 整備数", second: (m) => m.packages },
  { file: "docs/ai/architecture.md", pattern: /基盤\((\d+)\s*個/, expect: (m) => m.packages, label: "architecture.md のパッケージ数" },
];

export function check() {
  const m = measure();
  const issues = [];
  for (const rule of RULES) {
    const p = path.join(ROOT, rule.file);
    if (!existsSync(p)) {
      issues.push({ label: rule.label, message: `${rule.file} がありません` });
      continue;
    }
    const body = readFileSync(p, "utf8");
    const found = body.match(rule.pattern);
    if (!found) {
      issues.push({ label: rule.label, message: `${rule.file} に該当記述が見つかりません(パターン変更?)` });
      continue;
    }
    const actual = Number(found[1]);
    const expected = rule.expect(m);
    if (actual !== expected) {
      issues.push({ label: rule.label, message: `${rule.file}: ${actual} と書かれていますが実際は ${expected} です` });
    }
    if (rule.second) {
      const actual2 = Number(found[2]);
      const expected2 = rule.second(m);
      if (actual2 !== expected2) {
        issues.push({ label: rule.label, message: `${rule.file}: 分母が ${actual2} ですが実際は ${expected2} です` });
      }
    }
  }
  return { measured: m, issues };
}

function main() {
  const { measured, issues } = check();
  console.log(`実測: パッケージ ${measured.packages} / README ${measured.readmes} / アプリ ${measured.apps} / デモ ${measured.demos}(起動可 ${measured.runnableDemos} / 部品 ${measured.componentDemos})`);
  if (issues.length === 0) {
    console.log("✅ 手書きドキュメントの数値は実態と一致しています");
    return;
  }
  for (const i of issues) console.error(`❌ ${i.label}: ${i.message}`);
  console.error("\n手書きの資料は AI(Claude Code 等)が前提にします。古い数値は誤った判断を生むため修正してください。");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
