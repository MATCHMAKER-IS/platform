/**
 * ドキュメントが「実在しないもの」を案内していないか検査する。
 *   node tools/check-docs-links.mjs
 *
 * 初心者向けガイドで最も困るのは、書いてあるとおりにやったのに動かないこと。
 * 原因の多くは「コマンド名が変わった」「ファイルが移動した」といった単純なズレで、
 * 人のレビューでは見落とされる。ここで機械的に検出する。
 *
 * 検査対象(手書きドキュメント。自動生成物は check-generated の担当):
 *   1. `pnpm xxx` が package.json に実在するか
 *   2. Markdown の内部リンク先が実在するか
 *   3. 参照するファイルパス(`docs/...` `apps/...` 等)が実在するか
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

/** 検査するドキュメント(手書きのもの)。自動生成物は対象外。 */
const TARGETS = [
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "PLATFORM_SERVICES.md",
  "docs/APPS_AND_DEMOS.md",
  "docs/ops/GETTING_STARTED.md",
  "docs/ops/GETTING_STARTED_2.md",
  "docs/ops/GIT_GUIDE.md",
  "docs/ops/CURSOR_GUIDE.md",
  "docs/ops/TESTING_GUIDE.md",
  "docs/ops/DEVTOOLS_GUIDE.md",
  "docs/ops/INCIDENT_RESPONSE.md",
  "docs/README.md",
  "docs/ops/NEW_APP.md",
  "docs/ops/COMMANDS.md",
  "docs/ops/SETUP.md",
  "docs/ai/patterns.md",
  "docs/ai/mcp-catalog.md",
];

/** pnpm の組み込みコマンド(package.json に無くて当然)。 */
const PNPM_BUILTIN = new Set(["install", "add", "remove", "why", "outdated", "exec", "run", "dlx", "up", "list", "store", "config", "filter"]);
/** 説明文で使うプレースホルダ(実在しなくて当然)。 */
const PLACEHOLDERS = new Set(["xxx", "name", "cmd"]);

export function check() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const scripts = new Set(Object.keys(pkg.scripts ?? {}));
  const issues = [];
  let scanned = 0;

  // 0. package.json のコマンドが実在するファイルを指しているか。
  //    「実行すると必ず失敗する」コマンドは、打つまで気づけない(実際に gen:depgraph が壊れていた)
  for (const [name, body] of Object.entries(pkg.scripts ?? {})) {
    for (const m of String(body).matchAll(/(?:tools|scripts)\/[\w./-]+\.(?:mjs|mts|ts|sh|ps1)/g)) {
      if (!existsSync(path.join(ROOT, m[0]))) {
        issues.push(`package.json: \`pnpm ${name}\` が存在しないファイルを指しています → ${m[0]}`);
      }
    }
  }

  for (const rel of TARGETS) {
    const file = path.join(ROOT, rel);
    if (!existsSync(file)) {
      issues.push(`${rel}: ファイルがありません(TARGETS の指定ミス?)`);
      continue;
    }
    scanned += 1;
    const body = readFileSync(file, "utf8");
    const dir = path.dirname(file);

    // 1. pnpm コマンドの実在
    for (const m of body.matchAll(/`pnpm ([a-z][a-z0-9:]*)\b/g)) {
      const cmd = m[1];
      if (!cmd || PNPM_BUILTIN.has(cmd) || PLACEHOLDERS.has(cmd)) continue;
      // pnpm --filter xxx のような形は除外
      if (cmd === "filter") continue;
      if (!scripts.has(cmd)) issues.push(`${rel}: \`pnpm ${cmd}\` は package.json に存在しません`);
    }

    // 2. Markdown 内部リンク(相対パスの .md)
    for (const m of body.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const link = m[1];
      if (!link || link.startsWith("http")) continue;
      const target = path.resolve(dir, link);
      if (!existsSync(target)) issues.push(`${rel}: リンク切れ → ${link}`);
    }

    // 3. コード内で言及するリポジトリ内パス(バッククォート囲み)。
    //    ただし「これから作るもの」「例示」「MCP のメソッド名」は実在しなくて当然なので除外する。
    for (const m of body.matchAll(/`((?:docs|apps|packages|tools|scripts|demos)\/[A-Za-z0-9_./-]+)`/g)) {
      const p = m[1];
      if (!p) continue;
      if (p.includes("<") || p.includes("*")) continue;          // プレースホルダ
      if (/\bmy-app\b|\bmy-feature\b|\bsetup-guide\b/.test(p)) continue;  // 手順書の例示
      if (/^tools\/(list|call)$/.test(p)) continue;              // MCP のメソッド名(パスではない)
      if (!p.includes("/") || !/\.(ts|tsx|mts|mjs|md|json|ps1|sh|yml)$|\/$/.test(p)) {
        // 拡張子もスラッシュ終端も無いものはパスとは限らない(例: tools/list)
        if (!existsSync(path.join(ROOT, p))) continue;
      }
      if (!existsSync(path.join(ROOT, p))) {
        issues.push(`${rel}: 参照先がありません → ${p}`);
      }
    }
  }
  return { scanned, issues };
}

function main() {
  const { scanned, issues } = check();
  if (issues.length === 0) {
    console.log(`✅ ドキュメントの参照はすべて有効(${scanned} ファイル検査)`);
    return;
  }
  for (const i of issues) console.error(`❌ ${i}`);
  console.error(`\n${issues.length} 件。書いてあるとおりにやって動かないと初心者が詰まります。修正してください。`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
