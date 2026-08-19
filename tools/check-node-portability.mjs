#!/usr/bin/env node
/**
 * **Windows で静かに壊れる書き方**を見つける(tools / scripts)。
 *
 * 【なぜ要るか】
 * ここで見るのは、どちらも **Linux では偶然通り、Windows でだけ壊れる**。
 * しかも**エラーが出ない**ので、書いた本人も回した人も気づけない。
 *
 * 2026-08 に実際に起きた 2 件:
 *
 * | 書き方 | 何が起きたか |
 * |---|---|
 * | `new URL(...).pathname` をパスとして渡す | Windows では `/C:/Users/…` になり、解決すると **`C:\C:\Users\…`** と二重になる。`pnpm smoke` が google の節で停止した(9 箇所) |
 * | `import.meta.url === \`file://${process.argv[1]}\`` | `file:///C:/…` と `C:\…` は**一致しない**。本体が動かず、**何も出力せず終わる**。`node tools/check-coverage.mjs --set-floor` が無反応だった(7 本) |
 *
 * **後者が特に悪い。** 落ちるのではなく「静かに何もしない」ので、
 * **やったつもりで進む**。カバレッジの下限が一度も刻まれなかったのはこれが原因。
 *
 * 【正しい書き方】
 *
 * ```js
 * import path from "node:path";
 * import { fileURLToPath } from "node:url";
 *
 * // URL → パス
 * const ROOT = fileURLToPath(new URL("..", import.meta.url));
 *
 * // 直接実行されたか
 * if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 *   // …
 * }
 * ```
 *
 * パスではなく **URL のまま渡す**場面(`import()` / `readFile`)では `.href` を使う。
 *
 * 【対象】
 * `tools/` と `scripts/` の `.mjs` / `.mts`。
 * **アプリや基盤のソースは見ない**——`URL.pathname` は Web の URL では正しい用法で、
 * そこまで広げると誤検出だらけになる(`@platform/url` がまさにそれを扱う)。
 *
 * 実行: node tools/check-node-portability.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。 */
const DIRS = ["tools", "scripts"];

/**
 * 見逃してよいもの。**理由を必ず添える。**
 *
 * 除外を増やすときは「なぜ Windows で壊れないか」を書くこと。
 * 書けないなら、それは除外してよい理由が無い。
 */
const ALLOW = [
  {
    re: /^tools\/check-node-portability\.mjs$/,
    why: "この検査自身。説明とパターンに例が出てくる",
  },
  {
    re: /^tools\/verify-checks\.mjs$/,
    why: "検査を壊して確かめるための**違反の見本**を持つ。ここが緑だと、この検査自体を検証できない",
  },
  {
    re: /^tools\/smoke\.mjs$/,
    line: /url\.pathname\.startsWith|pp\.pathname|d\.pathname|d2\.pathname/,
    why: "Web の URL(`new URL('https://…')`)の pathname を見ている。ファイルパスではない",
  },
  {
    re: /^tools\/drill\.mjs$/,
    line: /u\.pathname = /,
    why: "接続文字列(postgres://…)の DB 名を差し替えている。ファイルパスではない",
  },
];

function allowed(rel, line) {
  return ALLOW.some((a) => a.re.test(rel) && (a.line === undefined || a.line.test(line)));
}

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "lib") continue;
      collect(full, out);
      continue;
    }
    if (/\.(mjs|mts|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** 判定するパターン。 */
const RULES = [
  {
    id: "PATHNAME",
    // `new URL(...).pathname` / `import.meta.url` 由来の pathname
    // **`[^)]*` は使わない。** 引数に `)` が入ると途中で切れます
    // (`check-regex-pitfalls` の指摘)。`.pathname` が出る行で、
    // **同じ行に `new URL(` か `import.meta.url` がある**かだけを見れば足りる
    re: /\.pathname/,
    // **ファイルの位置を指しているものだけ**に絞る。
    // `new URL("https://…").pathname` は Web の URL で、正しい用法
    also: /import\.meta\.url|new URL\(\s*["'`]\.{1,2}\//,
    message: "`.pathname` をパスとして使っています",
    fix: "`fileURLToPath(new URL(…))` を使ってください(URL のまま渡すなら `.href`)",
  },
  {
    id: "MAIN_GUARD",
    // import.meta.url === `file://${process.argv[1]}`(前後どちらの順でも)
    re: /`file:\/\/\$\{process\.argv\[1\]\}`/,
    message: "`file://${process.argv[1]}` で直接実行かを判定しています",
    fix: "`process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)` に直してください",
  },
  {
    id: "STRIP_SCHEME",
    // import.meta.url.replace("file://", "") の類
    re: /import\.meta\.url\s*\.replace\(\s*["'`]file:\/\//,
    message: "`import.meta.url` から `file://` を文字列で剥がしています",
    fix: "`fileURLToPath(import.meta.url)` を使ってください",
  },
];

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));
const offenders = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const body = readFileSync(file, "utf8");
  for (const [i, line] of body.split("\n").entries()) {
    // **コメントは見ない。** 注意書きに例を書いただけで落ちると、
    // 「書いてはいけない」と伝えること自体ができなくなる
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    for (const rule of RULES) {
      if (!rule.re.test(line)) continue;
      if (rule.also !== undefined && !rule.also.test(line)) continue;
      if (allowed(rel, line)) continue;
      offenders.push({ where: `${rel}:${i + 1}`, rule });
    }
  }
}

if (offenders.length === 0) {
  console.log(`✅ Windows で壊れる書き方はありません(${files.length} ファイルを検査 / ${DIRS.join(", ")})`);
  process.exit(0);
}

console.error(`❌ Windows で静かに壊れる書き方が ${offenders.length} 件あります(${files.length} ファイルを検査):`);
for (const o of offenders) {
  console.error(`   [${o.rule.id}] ${o.where}: ${o.rule.message}`);
  console.error(`             → ${o.rule.fix}`);
}
console.error("");
console.error("   **Linux では偶然通ります。** 手元で緑でも、Windows では");
console.error("   `pnpm smoke` が途中で止まったり、検査が何も出力せずに終わったりします。");
process.exit(1);
