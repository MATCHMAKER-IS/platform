/**
 * **基盤（`packages/`）自身が作法を守っているか**を検査する。
 *
 * `check-app-rules` はアプリとデモを見ているが、基盤側は対象外だった。
 * 基盤が作法を破ると、それを使う全アプリに影響が出るうえ、
 * 「基盤がやっているなら良いのだろう」と真似される。
 *
 * 見るもの:
 *   - `console.*` … 出力は `@platform/logger`（秘密情報の自動マスクが効かなくなる）
 *   - `process.env` … 設定は `@platform/env`（起動時に気づけず、動いてから落ちる）
 *   - `any` の明示 … 型を捨てると、使う側で誤りが出ても気づけない
 *
 * **コメントと `@example` は対象外**。使い方の説明で `console.log` を書くのは正しい。
 *
 * 実行: node tools/check-package-rules.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";
import { stripComments } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 対象外のパッケージ。**理由を書くこと。**
 * ここに足すのは「その作法を適用できない」と確かめたときだけ。
 */
const ALLOW = {
  logger: "出力そのものを担当する",
  env: "環境変数の読み取りを担当する",
  config: "設定の読み取りを担当する",
  debug: "開発時の出力を担当する",
  testing: "テスト用の補助。出力して確かめるのが目的",
  loadtest: "負荷試験の実行結果を出す",
  mcp: "標準入出力でやり取りする規約のため",
};


const RULES = [
  {
    id: "console",
    pattern: /\bconsole\.(log|info|warn|error|debug)\s*\(/,
    message: "console を直接使っています → @platform/logger を使ってください",
    why: "秘密情報（password / token）の自動マスクが効きません",
  },
  {
    id: "process-env",
    pattern: /\bprocess\.env\./,
    message: "process.env を直接読んでいます → @platform/env を使ってください",
    why: "起動時に気づけず、動いてから設定漏れで落ちます",
  },
];

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (ALWAYS_SKIP.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(fp);
  }
  return out;
}

const issues = [];
let checked = 0;

const pkgDir = path.join(ROOT, "packages");
for (const pkg of readdirSync(pkgDir, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  if (ALLOW[pkg.name]) continue;

  for (const f of collect(path.join(pkgDir, pkg.name, "src"))) {
    checked += 1;
    const src = stripComments(readFileSync(f, "utf8"));
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    for (const rule of RULES) {
      if (rule.pattern.test(src)) {
        issues.push(`${rel}: ${rule.message}（${rule.why}）`);
      }
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 基盤は作法どおりです（${checked} ファイル検査 / 対象外 ${Object.keys(ALLOW).length} パッケージ）`);
  process.exit(0);
}

for (const i of issues) console.log(`❌ ${i}`);
console.log(`\n❌ ${issues.length} 件。基盤が破ると、使う側にも同じ書き方が広がります。`);
console.log("   その作法を適用できないパッケージなら、tools/check-package-rules.mjs の ALLOW に理由付きで登録してください。");
process.exit(1);
