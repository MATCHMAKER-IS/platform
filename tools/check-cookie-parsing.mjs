#!/usr/bin/env node
/**
 * **クッキーを自前で解析していないかを確かめる。**
 *
 * 【なぜ要るか】
 * 2026-08 まで、`apps/internal-app` の **249 か所**が
 * `req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1]` と書いていた。
 * 1 か所で書かれた形が、新しい画面を足すたびにコピーされて増えたもの。
 *
 * この正規表現には**実害のあるバグ**がある。**部分一致**なので、
 * `zoho_session=...; session=...` のように**名前が `session` で終わる
 * 別のクッキー**があると、そちらの値を返す(このアプリは Zoho 連携なので
 * 現実的な危険だった)。URL エンコードも解けない。
 *
 * `@platform/session` の `getCookie` は名前で正しく分割し、デコードもする。
 * **249 か所すべてが同じバグを持っていた**のに、型検査も lint も
 * smoke も通っていた——「動いてはいるが正しくない」形の典型。
 *
 * 【なぜ `check-reimplementation` で足りないか】
 * あちらは**基盤と同名の関数**を定義しているかを見る。
 * ここで起きていたのは「関数を作らず、その場に正規表現を直書きする」形で、
 * 名前がどこにも現れないため素通りしていた。
 *
 * 実行: node tools/check-cookie-parsing.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/**
 * 自作の解析とみなす書き方。
 *
 * **`document.cookie` そのものは禁じない**(ブラウザ側で読む正当な用途がある)。
 * 止めたいのは**名前で切り出す処理を自分で書くこと**。
 */
const PATTERNS = [
  { re: /\.match\(\s*\/[^/]*=\(\[\^;\]\+\)\/\s*\)/, why: "正規表現でクッキーを切り出しています" },
  { re: /cookie[^\n]*\.split\(\s*["'];\s*["']\s*\)/i, why: "`;` で分割してクッキーを解析しています" },
];

/**
 * 基盤そのものと、解析を実装している場所は対象外。
 * **理由を必ず添える**(「なんとなく除外」を残さない)。
 */
const ALLOW = [
  { re: /^packages\/session\//, why: "解析の実装そのもの" },
  { re: /^packages\/http\//, why: "低レイヤの HTTP 取り扱い" },
  { re: /\.test\.tsx?$/, why: "テストは壊れた入力をわざと作る" },
  { re: /^tools\//, why: "検査ツールは違反の形を文字列で持つのが仕事" },
];

// **共通処理を使う**(除外ディレクトリの食い違いを防ぐ)。相対パスで返る
const files = collectFiles(["apps", "packages"], ROOT, { extensions: [".ts", ".tsx", ".mjs"] });
const issues = [];
let checked = 0;

for (const file of files) {
  const rel = file;
  if (ALLOW.some((a) => a.re.test(rel))) continue;
  if (rel.includes(".generated.")) continue;
  checked += 1;
  const lines = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    // コメントは対象外(「以前こう書いていた」という説明を残せるように)
    if (/^\s*(\*|\/\/)/.test(line)) continue;
    for (const p of PATTERNS) {
      if (p.re.test(line)) issues.push(`${rel}:${i + 1}: ${p.why}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ クッキーの自作解析はありません(${checked} ファイルを検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**@platform/session の \`getCookie\` を使ってください。**`);
console.error("自作の正規表現は部分一致するため、名前が後方一致する別のクッキーがあると");
console.error("そちらの値を返します(URL エンコードも解けません)。");
process.exit(1);
