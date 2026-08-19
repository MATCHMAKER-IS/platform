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
      // **`.tsx` も数える。**
      // `packages/ui` は大半が `.tsx` で、除くと 301 件が漏れていた
      // (2026-08 に気づいた)。拡張子を 1 つに絞らない
      else if (/\.tsx?$/.test(fp) && !/\.test\.tsx?$/.test(fp)) {
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
    // **showcase の画面数。** 「88 デモ」のような記述が資料にあるが、
    // `demos/` は統合済みで 0 なので、**別に数える**必要がある
    // ——2026-08 に HANDOVER の「88 デモ」が実際は 91 だったのを見つけた
    showcasePages: (() => {
      const dir = path.join(ROOT, "apps", "showcase", "src", "app");
      if (!existsSync(dir)) return 0;
      let n = 0;
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) walk(path.join(d, e.name));
          else if (e.name === "page.tsx") n += 1;
        }
      };
      walk(dir);
      return n;
    })(),
    runnableDemos,
    componentDemos: demoDirs.length - runnableDemos,
    // 検査ツールの数。**資料に「N 種類の検査」と書くとすぐ古くなる**
    // (実際に 44 のまま残っていた)。実測から見張る
    // E2E の本数は `test(` の数(ファイル数ではない)。
    // 資料には「E2E 14 本」と書いてあり、ファイル数(7)と混同しやすい
    // 契約テストの件数。**HANDOVER に「5 件(freee / google / paypal / zoho / line)」と
    // 書かれたまま、実際は 8 件(microsoft / notion / slack が増えていた)**。
    // 「鍵を用意する」作業の対象数なので、古いと準備が足りなくなる
    contracts: (() => {
      const dir = path.join(ROOT, "tests/contracts");
      if (!existsSync(dir)) return 0;
      return readdirSync(dir).filter((f) => f.endsWith(".contract.json")).length;
    })(),
    e2eTests: (() => {
      // **`apps/*/e2e/` も数える。** 2026-08 まで `e2e/` だけを見ており、
      // `apps/internal-app/e2e/` の 2 ファイルが**資料に載らなかった**
      // ——**あるのに無いことになる**ので、次の人が同じものを作りかける
      let extra = 0;
      const appsDir = path.join(ROOT, "apps");
      if (existsSync(appsDir)) {
        for (const app of readdirSync(appsDir)) {
          const d = path.join(appsDir, app, "e2e");
          if (!existsSync(d)) continue;
          for (const f of readdirSync(d)) {
            if (!f.endsWith(".spec.ts")) continue;
            extra += readFileSync(path.join(d, f), "utf8").match(/^test\(/gm)?.length ?? 0;
          }
        }
      }
      const dir = path.join(ROOT, "e2e");
      if (!existsSync(dir)) return 0;
      return readdirSync(dir)
        .filter((f) => f.endsWith(".spec.ts"))
        .reduce((n, f) => n + (readFileSync(path.join(dir, f), "utf8").match(/^test\(/gm)?.length ?? 0), 0) + extra;
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
    // **CHECKS.md の一覧に載っている検査の数。**
    // 「67 種類ある」という**数値だけ**を見張っていたので、
    // **一覧が 20 件古いまま**でも通っていた(2026-08)。
    // 数と中身の両方が合っていないと、**「載っていない検査」を知る手段が無い**
    // **資料の総数。** README の「資料の地図」が古くなると、
    // **どこを見ればよいか分からなくなる**——2026-08 に
    // 「4 箇所・42 件」と書いたが実際は **8 箇所・83 件**だった
    // (`docs/adr` 22 件と `docs/platform` 11 件を数え落としていた)
    docsTotal: (() => {
      const roots = [ROOT, path.join(ROOT, "docs")];
      const dirs = ["adr", "ai", "apps", "onboarding", "ops", "platform", "site"].map((d) => path.join(ROOT, "docs", d));
      let n = 0;
      for (const d of [...roots, ...dirs]) {
        if (!existsSync(d)) continue;
        n += readdirSync(d).filter((f) => f.endsWith(".md")).length;
      }
      return n;
    })(),
    checksListed: (() => {
      const md = path.join(ROOT, "docs/ops/CHECKS.md");
      if (!existsSync(md)) return 0;
      // **一覧の表に載っている検査名**(`check-` 以外も数える。
      // `smoke` / `advisor` / `api-surface` なども検査)
      const rows = readFileSync(md, "utf8").match(/^\| `([a-z0-9-]+)`/gm) ?? [];
      return new Set(rows.map((r) => r.replace(/^\| `|`$/g, ""))).size;
    })(),
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
/** `--fix` が指定されたか。**数値は機械的に決まるので、直させない。** */
const FIX = process.argv.includes("--fix");

const RULES = [
  { file: "docs/ops/CHECKS.md", pattern: /\*\*依存をインストールせずに (\d+) 種類の検査\*\*/, expect: (m) => m.checks, label: "CHECKS.md の検査の種類数" },
  // **一覧に何件載っているか**も見張る。数値だけだと、
  // **「67 種類ある」と書きながら一覧は 48 件**という状態が通る(2026-08)。
  // 表の行数そのものを数えるので、行を消すと落ちる
  { file: "docs/ops/CHECKS.md", pattern: /下の表には \*\*(\d+) 種類\*\*を載せています/, expect: (m) => m.checksListed, label: "CHECKS.md の一覧に載っている検査の数" },
  // **資料の総数**(README の「資料の地図」)。古いと**どこを見ればよいか分からない**
  { file: "README.md", pattern: /\*\*全部で (\d+) 件\*\*あります/, expect: (m) => m.docsTotal, label: "README の資料の総数" },
  // **showcase の画面数**(「88 デモ」のような記述)。引き継いだ人が
  // 「一通り眺める」ときの目安になるので、ずれていると当てが外れる
  { file: "docs/ops/HANDOVER.md", pattern: /（(\d+) デモ）/, expect: (m) => m.showcasePages, label: "HANDOVER の showcase 画面数" },

  // HANDOVER にも同じ数字が 2 か所ある。**片方だけ直すとズレる**ので両方見る
  { file: "docs/ops/HANDOVER.md", pattern: /\*\*(\d+) 種類の検査\*\*が `preflight`/, expect: (m) => m.checks, label: "HANDOVER の検査の種類数" },
  { file: "docs/ops/HANDOVER.md", pattern: /\*\*検査 (\d+) 件すべてを分類済み\*\*/, expect: (m) => m.checks, label: "HANDOVER の verify-checks 分類数" },
  { file: "docs/ops/HANDOVER.md", pattern: /E2E \*\*(\d+) 本\*\*/, expect: (m) => m.e2eTests, label: "HANDOVER の E2E 本数" },
  { file: "docs/ops/HANDOVER.md", pattern: /契約は \*\*(\d+) 件\*\*/, expect: (m) => m.contracts, label: "HANDOVER の契約件数" },
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
  const nav = path.join(ROOT, "apps/showcase/src/lib/nav.ts");
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
/**
 * **自動生成かどうかは、ファイル自身の宣言で判定する(一覧を手書きしない)。**
 *
 * 2026-08 まで「`docs/platform/` 配下すべて」と「`docs/ai/mcp-catalog.md`」を
 * 手で除外していたが、**どちらも実態と食い違っていた**:
 *
 *  - `docs/ai/mcp-catalog.md` は生成物として除外されていたが**手書き**。
 *    「113 パッケージ」という古い値が 2 か所、素通りしていた
 *  - `docs/platform/` を丸ごと外していたため、その中の手書き `CATALOG.md` も対象外。
 *    ここにも「全 113 パッケージ」が残っていた
 *
 * 一覧を手で持つと、資料が生成物になったり手書きに戻ったりするたびにズレる。
 * この基盤では「対象一覧の手書き」で何度も穴を開けている。
 * 生成物は冒頭で必ずそう名乗る(`> 自動生成: …(手で編集しない)`)ので、それを読む。
 */
const GENERATED_MARK = /自動生成|手で編集しない|自動更新/;

/** 冒頭の数行に生成物の宣言があるか。 */
function isGenerated(file) {
  try {
    return GENERATED_MARK.test(readFileSync(file, "utf8").split("\n").slice(0, 8).join("\n"));
  } catch {
    return false;
  }
}

function checkPackageCountEverywhere(actual, issues) {
  const targets = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(fp);
      } else if (e.name.endsWith(".md") && !isGenerated(fp)) {
        // 自動生成物は check-generated が守る。ここで見ると、
        // 生成側が正しくても「古い」と誤って指摘してしまう
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
    let changed = false;
    lines.forEach((line, i) => {
      if (line.includes("doc-numbers:ignore")) return;
      for (const mm of line.matchAll(/(\d{2,4})\s*パッケージ/g)) {
        const n = Number(mm[1]);
        // 桁が近い数値だけを対象にする(「3 パッケージ」等の説明文を巻き込まない)
        if (n < 50 || n > 500 || n === actual) continue;
        // **ここも `--fix` で直す。** 2026-08 まで検出だけして直さなかったため、
        // 隠れていた 3 件を見つけても手で書き換えるしかなかった。
        // 「機械で分かる数値を人に直させない」という方針は、
        // **見つける側と直す側の両方に適用しないと意味がない**。
        if (FIX) {
          lines[i] = lines[i].replace(mm[0], mm[0].replace(String(n), String(actual)));
          changed = true;
          console.log(`✏ ${rel}:${i + 1}: 「${n} パッケージ」→「${actual} パッケージ」`);
          continue;
        }
        issues.push({ label: `${rel}:${i + 1}`, message: `「${n} パッケージ」は古い値です(実際は ${actual})` });
      }
    });
    if (changed) writeFileSync(f, lines.join("\n"));
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
      // **`--fix` で直す。**
      // 数値は機械的に決まるので、手で直させると
      // 「直す作業」だけが残って中身の検査が形骸化する(2026-08、
      // このセッションだけで API 本数・検査数・上限を 8 回手で直した)。
      //
      // **カンマ区切りは保つ。** `1,377` を `1377` に書き換えると
      // 資料の見た目が揃わなくなる
      if (FIX) {
        const grouped = String(found[1]).includes(",");
        const next = grouped ? expected.toLocaleString("en-US") : String(expected);
        const fixed = body.replace(found[0], found[0].replace(String(found[1]), next));
        writeFileSync(p, fixed);
        console.log(`✏ ${rule.file}: ${rule.label} を ${actual} → ${expected} に更新`);
        continue;
      }
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
    // **存在しないアプリ名が資料に残っていないか。**
// 2026-08 に `equipment-app`(統合されて無くなった)が **5 ファイル**に
// 「現在あるもの」として残っていた——**AI や新しい人が読むと、
// 無いものを前提に設計する**。統廃合の記録(ADR / ONBOARDING の日付付きの行)は
// 正しいので、**「現在形で書かれているか」**で見分ける。
{
  const apps = new Set(readdirSync(path.join(ROOT, "apps")));
  /**
   * **手順書の例として出てくる名前。** 実在しなくてよい。
   *
   * `my-app` は `pnpm new-app` の説明、`demos` は smoke のセクション名。
   */
  const EXAMPLE_APPS = new Set(["my-app", "demos"]);
  const docs = [];
  const walkDocs = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p2 = path.join(d, e.name);
      if (e.isDirectory()) walkDocs(p2);
      else if (e.name.endsWith(".md")) docs.push(p2);
    }
  };
  walkDocs(path.join(ROOT, "docs"));
  const ghosts = [];
  for (const f of docs) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    // **記録は対象外**(統廃合の経緯・引き継ぎの履歴)
    // **記録は対象外**(統廃合の経緯・引き継ぎの履歴・開発の経過)。
    // `HISTORY.md` は**2026-07 までの作業記録**で、冒頭に
    // 「**`equipment-app` は存在しません**」と明記してある
    if (/HANDOVER\.md|onboarding\/04-task\.md|docs\/HISTORY\.md|docs\/adr\//.test(rel)) continue;
    const body = readFileSync(f, "utf8");
    // **単語の終わりまで見る。** `apps/internal-app/src/...` の途中で切ると
    // `apps/internal` という存在しない名前になる
    // **URL のパスは対象外**(`/apps/cart` は画面の URL であってアプリ名ではない)。
    // 直前が `/` や `` ` `` で始まるものは URL とみなす
    for (const m of body.matchAll(/(?<![/`])\bapps\/([a-z][a-z0-9-]*)(?![a-z0-9-])/g)) {
      const name = m[1];
      if (apps.has(name) || EXAMPLE_APPS.has(name)) continue;
      ghosts.push(`${rel}: apps/${name}`);
    }
  }
  if (ghosts.length > 0) {
    console.error(`❌ 資料に存在しないアプリが ${ghosts.length} 件あります:`);
    for (const g of ghosts.slice(0, 8)) console.error(`   ${g}`);
    console.error("");
    console.error("**無いものを前提に設計されます。** 実在するアプリに直すか、");
    console.error("統廃合の記録なら日付を添えて「かつてあった」と分かるように書いてください。");
    process.exit(1);
  }
}

console.log(`✅ 手書きドキュメントの数値は実態と一致しています(パッケージ ${measured.packages} / アプリ ${measured.apps})`);
    return;
  }
  for (const i of issues) console.error(`❌ ${i.label}: ${i.message}`);
  console.error("\n手書きの資料は AI(Claude Code 等)が前提にします。古い数値は誤った判断を生むため修正してください。");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
