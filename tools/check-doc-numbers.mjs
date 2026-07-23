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
  // 公開 export（関数・定数・クラス）の総数。TSDoc の網羅率を語る資料で使われる。
  let exportsCount = 0;
  const walkPkg = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walkPkg(fp);
      else if (fp.endsWith(".ts") && !fp.endsWith(".test.ts")) {
        exportsCount += (readFileSync(fp, "utf8").match(/^export (function|const|class) /gm) ?? []).length;
      }
    }
  };
  walkPkg(pkgDir);

  return {
    packages: packages.length,
    exportsCount,
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

/**
 * 全文書を横断して「N パッケージ」の記述を拾う。
 *
 * 個別ルールだけだと、新しく書いた資料の数値が野放しになる。
 * 「103 パッケージ」のような古い数字は、読んだ人に誤った前提を与えるため機械的に潰す。
 * 履歴として過去の数を書いている箇所は `<!-- doc-numbers:ignore -->` を同じ行に置く。
 */
/**
 * アプリの規模(画面数・API 数・モデル数)が資料と合っているか。
 *
 * 実際に「crud-template は画面 1 なのに 79 と書かれている」状態が起きていた
 * (internal-app の記述をコピーしたまま数字を直し忘れたもの)。
 * 規模の誤りは「このアプリは大きい/小さい」という判断を誤らせるため機械的に潰す。
 */
/**
 * 資料に書いたデモ本数が nav.ts と合っているか。
 * デモの追加・統合は頻繁に起きるため、手書きの本数はすぐ古くなる。
 */
function checkDemoCounts(issues) {
  const nav = path.join(ROOT, "demos/showcase/src/lib/nav.ts");
  const doc = path.join(ROOT, "docs/APPS_AND_DEMOS.md");
  if (!existsSync(nav) || !existsSync(doc)) return;
  const src = readFileSync(nav, "utf8");
  const platform = (src.split("PLATFORM_DEMOS")[1] ?? "").split("APP_DEMOS")[0].match(/href:/g)?.length ?? 0;
  const codeExamples = (src.split("CODE_EXAMPLES")[1] ?? "").split("SECTIONS")[0].match(/href:/g)?.length ?? 0;
  const appDemos = (src.split("APP_DEMOS")[1] ?? "").split("CODE_EXAMPLES")[0].match(/href:/g)?.length ?? 0;
  const all = platform + appDemos + codeExamples;
  const body = readFileSync(doc, "utf8");
  const m = body.match(/基盤デモ (\d+) 本・アプリ画面デモ (\d+) 本・使用例 (\d+) 本（計 (\d+)）/);
  if (!m) {
    issues.push({ label: "docs/APPS_AND_DEMOS.md", message: "デモ本数の記述が見つかりません(書式変更?)" });
    return;
  }
  if (Number(m[1]) !== platform) {
    issues.push({ label: "docs/APPS_AND_DEMOS.md", message: `基盤デモ ${m[1]} 本は古い値です(実際は ${platform})` });
  }
  if (Number(m[4]) !== all) {
    issues.push({ label: "docs/APPS_AND_DEMOS.md", message: `計 ${m[4]} は古い値です(実際は ${all})` });
  }
}

function checkAppMetrics(issues) {
  const f = path.join(ROOT, "docs/APPS_AND_DEMOS.md");
  if (!existsSync(f)) return;
  const body = readFileSync(f, "utf8");
  const appsDir = path.join(ROOT, "apps");
  if (!existsSync(appsDir)) return;

  const countFiles = (dir, name) => {
    if (!existsSync(dir)) return 0;
    let n = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) n += countFiles(fp, name);
      else if (e.name === name) n += 1;
    }
    return n;
  };

  // 資料に出てくる「画面 N」を、どのアプリの節かと対応付けるのは難しいため、
  // 「画面 N」の N が、いずれかのアプリの実測値と一致するかだけを見る。
  const actuals = new Set();
  for (const app of readdirSync(appsDir)) {
    const src = path.join(appsDir, app, "src/app");
    if (!existsSync(src)) continue;
    actuals.add(countFiles(src, "page.tsx"));
  }
  for (const m of body.matchAll(/\*\*画面 (\d+)/g)) {
    const n = Number(m[1]);
    if (!actuals.has(n)) {
      issues.push({
        label: "docs/APPS_AND_DEMOS.md",
        message: `「画面 ${n}」に一致するアプリがありません(実測: ${[...actuals].sort((a, b) => a - b).join(", ")})`,
      });
    }
  }
}

function checkExportCountEverywhere(actual, issues) {
  const f = path.join(ROOT, "CLAUDE.md");
  if (!existsSync(f)) return;
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("doc-numbers:ignore")) return;
    for (const mm of line.matchAll(/全\s*([\d,]+)\s*関数/g)) {
      const n = Number(mm[1].replace(/,/g, ""));
      // 増減は日常的に起きるため、1 割以上ずれたときだけ指摘する
      if (Math.abs(n - actual) > actual * 0.1) {
        issues.push({ label: `CLAUDE.md:${i + 1}`, message: `「全 ${mm[1]} 関数」は実態(${actual})と1割以上ずれています` });
      }
    }
  });
}

function checkPackageCountEverywhere(actual, issues) {
  const targets = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith(".md")) targets.push(fp);
    }
  };
  walk(path.join(ROOT, "docs"));
  targets.push(path.join(ROOT, "CLAUDE.md"));

  for (const f of targets) {
    if (!existsSync(f)) continue;
    const rel = path.relative(ROOT, f);
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("doc-numbers:ignore")) return;
      for (const mm of line.matchAll(/(\d{2,4})\s*パッケージ/g)) {
        const n = Number(mm[1]);
        // 桁が近い数値だけを対象にする(「3 パッケージ」等の説明文を巻き込まない)
        if (n >= 50 && n <= 500 && n !== actual) {
          issues.push({ label: `${rel}:${i + 1}`, message: `「${n} パッケージ」は古い値です(実際は ${actual})` });
        }
      }
    });
  }
}

export function check() {
  const m = measure();
  const issues = [];
  checkPackageCountEverywhere(m.packages, issues);
  checkExportCountEverywhere(m.exportsCount, issues);
  checkAppMetrics(issues);
  checkDemoCounts(issues);
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
