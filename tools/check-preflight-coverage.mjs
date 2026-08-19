#!/usr/bin/env node
/**
 * **作った検査が preflight から呼ばれているかを確かめる。**
 *
 * 【なぜ要るか】
 * 検査を書いても `preflight.mjs` に登録しなければ、**CI では一度も動かない**。
 * ファイルは存在し、手で叩けば正しく動くので、**作った本人は「入れた」と思っている**。
 *
 * 2026-08 に実際に起きた:
 *  - `check-cookie-parsing` / `check-api-error-shape` / `check-css-vars` /
 *    `check-allow-lists` / `check-ime-enter` / `check-locale-compare` /
 *    `check-scan-reporting` の **7 本が未登録**だった。
 *    置換スクリプトが対象文字列に一致せず静かに失敗したのが原因で、
 *    「登録した」と報告したまま何セッションも動いていなかった
 *  - `check-locale-format`(サーバの `LANG` で金額表記が変わる問題を見る)も
 *    **verify-checks には登録され、preflight だけ抜けていた**
 *
 * `verify-checks` は「違反を置くと赤になるか」を見るが、
 * **CI で実際に走るかは見ていない**。そこが抜けていた。
 *
 * 【なぜ grep 1 回で済むのに検査にするか】
 * 済むからこそ、誰もやらない。**確認は仕組みに載せないと続かない**——
 * この基盤が繰り返し記録してきたとおり。
 *
 * 実行: node tools/check-preflight-coverage.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = path.join(ROOT, "tools");

/**
 * preflight から呼ばれなくてよいもの。**理由を必ず添える。**
 */
const ALLOW = [
  {
    re: /^check-tsdoc\.mjs$/,
    why: "他の検査へ analyze / missingOf を提供するライブラリ。単体では何も検査しない(smoke が使う)",
  },
  {
    re: /^check-mail-dns\.mjs$/,
    why: "**DNS を実際に引く**診断ツール。CI(ネットワーク制限あり)では常に skip になり、"
      + "緑でも何も確かめていない状態になる。**送信ドメインを変えたとき**に人が叩くもので、"
      + "手順は docs/ops/MAIL_DELIVERABILITY.md に書いてある",
  },
];

const preflight = readFileSync(path.join(TOOLS, "preflight.mjs"), "utf8");
const verify = readFileSync(path.join(TOOLS, "verify-checks.mjs"), "utf8");

const tools = readdirSync(TOOLS).filter((f) => /^check-.*\.mjs$/.test(f));

const notRun = [];
for (const tool of tools) {
  if (ALLOW.some((a) => a.re.test(tool))) continue;
  if (preflight.includes(tool)) continue;
  // **verify-checks にだけ載っている形を特に指摘する。**
  // 「登録した」という記憶が残りやすく、見落としやすい
  notRun.push(verify.includes(tool)
    ? `${tool}(verify-checks には登録済み。preflight だけ抜けています)`
    : tool);
}

if (notRun.length === 0) {

// **逆方向も見る。** preflight から呼ばれているだけでなく、
// **`CHECKS.md` の一覧にも載っているか**を確かめる。
//
// 載っていない検査は**存在を知る手段が無い**——「こういう検査があるのか」と
// 気づけないので、**同じものを作りかける**。2026-08 に `CHECKS.md` が
// **20 件古い**状態(67 種類あると書きながら一覧は 48 件)だったのを直した。
{
  const checksMd = readFileSync(path.join(ROOT, "docs/ops/CHECKS.md"), "utf8");
  const listed = new Set(
    [...checksMd.matchAll(/^\| `([a-z0-9-]+)`/gm)].map((m) => m[1]),
  );
  const called = new Set(
    [...preflight.matchAll(/run\(\s*"([a-z0-9-]+)"/g)].map((m) => m[1]),
  );
  const missing = [...called].filter((n) => !listed.has(n));
  if (missing.length > 0) {
    console.error(`❌ preflight から呼ばれているのに CHECKS.md に載っていない検査が ${missing.length} 件あります:`);
    for (const n of missing) console.error(`   ${n}`);
    console.error("");
    console.error("**載っていない検査は存在を知る手段がありません**——同じものを作りかけます。");
    console.error("`docs/ops/CHECKS.md` の一覧表に 1 行足してください。");
    process.exit(1);
  }
}

  console.log(`✅ 検査はすべて preflight から呼ばれています(${tools.length} 本を確認)`);
  process.exit(0);
}
for (const t of notRun) console.error(`❌ tools/${t}`);
console.error(`\n${notRun.length} 本。**CI では一度も動きません。**`);
console.error("ファイルはあり、手で叩けば動くので、作った本人は入れたつもりになります。");
console.error("`tools/preflight.mjs` に `allOk = run(...)` を足してください。");
console.error("呼ばれなくてよいものは ALLOW に理由付きで登録すること。");
process.exit(1);
