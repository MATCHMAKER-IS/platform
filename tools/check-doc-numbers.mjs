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
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
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
    // 検査ツールの数。**資料に「N 種類の検査」と書くとすぐ古くなる**
    // (実際に 44 のまま残っていた)。実測から見張る
    // E2E の本数は `test(` の数(ファイル数ではない)。
    // 資料には「E2E 14 本」と書いてあり、ファイル数(7)と混同しやすい
    e2eTests: (() => {
      const dir = path.join(ROOT, "e2e");
      if (!existsSync(dir)) return 0;
      return readdirSync(dir)
        .filter((f) => f.endsWith(".spec.ts"))
        .reduce((n, f) => n + (readFileSync(path.join(dir, f), "utf8").match(/^test\(/gm)?.length ?? 0), 0);
    })(),
    // API ルートの本数(app/api/**/route.ts)。資料に「API 252 本」と書いてあり、
    // 増減が分かりにくいので機械的に数える
    apiRoutes: (() => {
      let n = 0;
      const walk = (dir) => {
        if (!existsSync(dir)) return;
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (e.name === "node_modules" || e.name === ".next") continue;
          const fp = path.join(dir, e.name);
          if (e.isDirectory()) walk(fp);
          else if (e.name === "route.ts" && fp.includes(`${path.sep}api${path.sep}`)) n += 1;
        }
      };
      walk(path.join(ROOT, "apps"));
      walk(path.join(ROOT, "demos"));
      return n;
    })(),
    // ラチェットの記録ファイルから上限を読む
    ...(() => {
      try {
        const j = JSON.parse(readFileSync(path.join(ROOT, "tools/maintainability-limit.json"), "utf8"));
        return { longLinesLimit: j.longLines, bigFilesLimit: j.bigFiles };
      } catch {
        return { longLinesLimit: 0, bigFilesLimit: 0 };
      }
    })(),
    checks: readdirSync(path.join(ROOT, "tools"))
      .filter((f) => f.startsWith("check-") && f.endsWith(".mjs")).length,
    // GitHub Actions の数。資料の一覧と食い違うと、
    // 「動いているはずのものが無い / 無いはずのものが動く」に気づけない
    workflows: existsSync(path.join(ROOT, ".github/workflows"))
      ? readdirSync(path.join(ROOT, ".github/workflows")).filter((f) => f.endsWith(".yml")).length
      : 0,
  };
}

/**
 * 検査ルール。file の中の pattern が実測値と一致するかを見る。
 * pattern は「数値部分を (\d+) で captureする正規表現」。
 */
const RULES = [
  { file: "docs/ops/CHECKS.md", pattern: /\*\*依存をインストールせずに (\d+) 種類の検査\*\*/, expect: (m) => m.checks, label: "CHECKS.md の検査の種類数" },
  // HANDOVER にも同じ数字が 2 か所ある。**片方だけ直すとズレる**ので両方見る
  { file: "docs/ops/HANDOVER.md", pattern: /\*\*(\d+) 種類の検査\*\*が `preflight`/, expect: (m) => m.checks, label: "HANDOVER の検査の種類数" },
  { file: "docs/ops/HANDOVER.md", pattern: /\*\*検査 (\d+) 件すべてを分類済み\*\*/, expect: (m) => m.checks, label: "HANDOVER の verify-checks 分類数" },
  { file: "docs/ops/HANDOVER.md", pattern: /E2E \*\*(\d+) 本\*\*/, expect: (m) => m.e2eTests, label: "HANDOVER の E2E 本数" },
  { file: "docs/ops/HANDOVER.md", pattern: /API \*\*(\d+) 本すべて\*\*/, expect: (m) => m.apiRoutes, label: "HANDOVER の API 本数" },
  // ラチェット(上限)の値。**手で書いた数値は必ず古くなる**ので、記録ファイルと照合する。
  // 実際に「生タグ 33 / 色 67 / 未実戦 11」と書かれたまま、すべて 0 になっていた
  { file: "docs/ops/HANDOVER.md", pattern: /\| 長い行（200 字超） \| ([\d,]+) \|/, expect: (m) => m.longLinesLimit, label: "HANDOVER の長い行の上限" },
  { file: "docs/ops/CHECKS.md", pattern: /\| 大きいファイル・長い行 \| (\d+) 件/, expect: (m) => m.bigFilesLimit, label: "CHECKS.md の大きいファイルの上限" },
  // HANDOVER は「引き継ぐ人が最初に読む」資料。ここの数値が古いと、
  // 規模の見積もりを誤らせる(実際にアプリ 5→6、smoke 1,446→1,451 とずれていた)
  { file: "docs/ops/HANDOVER.md", pattern: /\| アプリ \| \*\*(\d+) つ\*\*/, expect: (m) => m.apps, label: "HANDOVER のアプリ数" },
  { file: "docs/ops/HANDOVER.md", pattern: /\*\*(\d+) 種類の検査\*\*が `preflight`/, expect: (m) => m.checks, label: "HANDOVER の検査の種類数" },
  { file: "docs/ops/HANDOVER.md", pattern: /`docs\/ops\/CHECKS\.md` — (\d+) 種類の検査/, expect: (m) => m.checks, label: "HANDOVER の関連資料リンク" },
  { file: "CLAUDE.md", pattern: /(\d+)\s*パッケージのカテゴリ別インデックス/, expect: (m) => m.packages, label: "CLAUDE.md のパッケージ数" },
  // 統合により demos は 1 サイトのみ(以前の「コンポーネント型 26」は showcase に取り込み済み)
    // ルートの README も見る。ここは「初めて見る人が最初に読む」場所なので、
  // 数値が古いと基盤の規模を誤解させる（実際に 99 と 90 のまま残っていた）。
  { file: "README.md", pattern: /\*\*(\d+) の再利用可能なパッケージ\*\*/, expect: (m) => m.packages, label: "README のパッケージ数" },
  { file: "README.md", pattern: /基盤 (\d+) パッケージ/, expect: (m) => m.packages, label: "README のディレクトリ説明" },
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

  // **`--fix` で書き直す。** デモの追加はよく起きるうえ、数値は nav.ts から
  // 機械的に決まる。手で直させると、直す作業だけが残って中身の検査が形骸化する。
  if (process.argv.includes("--fix")) {
    // 検査の種類数も同じ理由で自動更新する(tools/check-*.mjs を数えるだけ)
    const checks = readdirSync(path.join(ROOT, "tools"))
      .filter((f) => f.startsWith("check-") && f.endsWith(".mjs")).length;
    for (const rel of ["docs/ops/CHECKS.md", "docs/ops/HANDOVER.md"]) {
      const fp = path.join(ROOT, rel);
      if (!existsSync(fp)) continue;
      const before = readFileSync(fp, "utf8");
      const after = before
        .replace(/\*\*依存をインストールせずに \d+ 種類の検査\*\*/, `**依存をインストールせずに ${checks} 種類の検査**`)
        .replace(/\*\*\d+ 種類の検査\*\*が `preflight`/, `**${checks} 種類の検査**が \`preflight\``)
        .replace(/`docs\/ops\/CHECKS\.md` — \d+ 種類の検査/, `\`docs/ops/CHECKS.md\` — ${checks} 種類の検査`);
      if (after !== before) { writeFileSync(fp, after); console.log(`✏ ${rel} を更新: 検査 ${checks} 種類`); }
    }
    const fixed = body.replace(
      m[0],
      `基盤デモ ${platform} 本・アプリ画面デモ ${appDemos} 本・使用例 ${codeExamples} 本（計 ${all}）`,
    );
    if (fixed !== body) {
      writeFileSync(doc, fixed);
      console.log(`✏ docs/APPS_AND_DEMOS.md を更新: 基盤 ${platform} / アプリ ${appDemos} / 使用例 ${codeExamples} = ${all}`);
    }
    // HANDOVER の「N デモ」も揃える
    const hand = path.join(ROOT, "docs/ops/HANDOVER.md");
    if (existsSync(hand)) {
      const hs = readFileSync(hand, "utf8");
      const hf = hs.replace(/（\d+ デモ）/, `（${all} デモ）`);
      if (hf !== hs) { writeFileSync(hand, hf); console.log(`✏ docs/ops/HANDOVER.md を更新: ${all} デモ`); }
    }
    return;
  }
  if (Number(m[1]) !== platform) {
    issues.push({ label: "docs/APPS_AND_DEMOS.md", message: `基盤デモ ${m[1]} 本は古い値です(実際は ${platform})` });
  }
  if (Number(m[4]) !== all) {
    issues.push({ label: "docs/APPS_AND_DEMOS.md", message: `計 ${m[4]} は古い値です(実際は ${all})` });
  }
}

/**
 * GitHub Actions の一覧が資料と合っているか。
 *
 * ワークフローは増えても資料は自動で増えない。**動いているのに一覧に無い**と、
 * 落ちたとき「これは何の確認か」が分からず、直しようがなくなる。
 */
function checkWorkflowDocs(issues) {
  const dir = path.join(ROOT, ".github/workflows");
  const doc = path.join(ROOT, "docs/ops/GITHUB_ACTIONS.md");
  if (!existsSync(dir) || !existsSync(doc)) return;
  const body = readFileSync(doc, "utf8");
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml"));
  for (const f of files) {
    // ワークフローの `name:` が資料に出てくるかを見る
    const src = readFileSync(path.join(dir, f), "utf8");
    const m = src.match(/^name:\s*(.+)$/m);
    if (!m) continue;
    const name = m[1].trim().replace(/^["']|["']$/g, "");
    if (!body.includes(name)) {
      issues.push({
        label: "docs/ops/GITHUB_ACTIONS.md",
        message: `ワークフロー「${name}」(${f}) が一覧にありません。動いているのに何の確認か分かりません`,
      });
    }
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

/** 自動生成されるフォルダ。中身は生成側が正しさを保つ。 */
const GENERATED_DIRS = ["platform", "erd", "appmap"];

/** 自動生成されるファイル。 */
const GENERATED_FILES = ["docs/ai/module-list.md", "docs/ai/mcp-catalog.md"];

function checkPackageCountEverywhere(actual, issues) {
  const targets = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        // 自動生成物は check-generated が守る。ここで見ると、
        // 生成側が正しくても「古い」と誤って指摘してしまう
        if (GENERATED_DIRS.includes(e.name)) continue;
        walk(fp);
      } else if (e.name.endsWith(".md") && !GENERATED_FILES.includes(path.relative(ROOT, fp).replace(/\\/g, "/"))) {
        targets.push(fp);
      }
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
  checkWorkflowDocs(issues);
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
    // 資料では「1,396 行」のようにカンマ区切りで書くので、除いてから数値にする
    const actual = Number(String(found[1]).replace(/,/g, ""));
    const expected = rule.expect(m);
    if (actual !== expected) {
      issues.push({ label: rule.label, message: `${rule.file}: ${actual} と書かれていますが実際は ${expected} です` });
    }
    if (rule.second) {
      const actual2 = Number(String(found[2]).replace(/,/g, ""));
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
