#!/usr/bin/env node
/**
 * **検査が「何件見たか」を報告しているかを確かめる。**
 *
 * 【なぜ要るか】
 * 緑の検査は読まれない。だから**対象が縮んでも誰も気づかない**。
 *
 * 2026-08 に実際に起きた形:
 *  - `check-utc-date` は `toISOString()` だけを見ており、`getFullYear()` 系は素通り。
 *    **9 箇所のタイムゾーン依存**(会計 8 + 採番 1)が残っていた
 *  - `check-docs-links` は `docs/` しか見ず、コード側の「実例は〜を参照」は対象外。
 *    雛形が**統合で消えたアプリ**を案内していた
 *  - `check-doc-numbers` の除外一覧が実態と食い違い、手書きの資料 3 件が素通り
 *  - `check-api-error-shape`(私が作った)はアプリ名を手書きし、**showcase 17 件を取りこぼした**
 *
 * いずれも「検査はあるのに範囲が足りない」。
 * **走査量が出ていれば、`1801 ファイル` が `12 ファイル` に落ちたときに気づける。**
 * 出ていなければ、緑という結果だけが残る。
 *
 * 【何を求めるか】
 * 成功時の出力に**数を含めること**だけ。書式は問わない
 * (`262 本` / `1801 ファイルを検査` / `全 5 アプリ` など)。
 * 数の意味は検査ごとに違ってよく、**前回と比べられれば目的は果たせる**。
 *
 * 実行: node tools/check-scan-reporting.mjs
 *
 * 【時間がかかります】
 * **60 個の検査を実際に実行**して出力を見るので、**数分かかります**。
 * 手元で急ぐときは飛ばして構いません——**CI では必ず走ります**。
 *
 * 「走査量を報告しているか」は**実行しないと分からない**ので、
 * この重さは避けられません。**静的に探す形にすると、
 * 書いてあるだけで実行時は 0 件**という場合を見逃します。
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

// **この検査は遅い（1 分以上）。**
//
// **67 個の検査を `spawnSync` で順に起動**するためです——
// **1 つずつ Node を立ち上げる**ので、どうしても時間がかかります。
//
// **preflight がタイムアウトする原因**でもあります。
// **速くするなら並列化**が要りますが、**同時に 67 個立ち上げると
// メモリを食い潰す**ので、**数個ずつ**にしてください。
//
// **急ぐときは preflight から外して、CI だけで回す**のも手です。
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = path.join(ROOT, "tools");

/**
 * 走査量を出さなくてよい検査。**理由を必ず添える。**
 */
const ALLOW = [
  { re: /^check-lockfile\.mjs$/, why: "1 ファイルの有無だけを見る。数える対象が無い" },
  { re: /^check-debt-slack\.mjs$/, why: "上限ファイルの数を出しており、走査ではない" },
  { re: /^check-generated\.mjs$/, why: "生成物を 1 つずつ名前で報告している" },
  { re: /^check-syntax\.mjs$/, why: "環境によって skip される(tsc 依存)" },
  { re: /^check-path-length\.mjs$/, why: "環境によって skip される(Windows 前提)" },
  { re: /^check-coverage\.mjs$/, why: "環境によって skip される(coverage-summary.json はテスト実行後にしか無い)" },
  // **単体で走らせる検査ではない。** `analyze` / `missingOf` を他の検査へ提供する
  // ライブラリで、smoke がこれを使って TSDoc の完備を見ている
  { re: /^check-tsdoc\.mjs$/, why: "他の検査が使うライブラリ。単体では何も検査しない" },
];

const tools = readdirSync(TOOLS)
  .filter((f) => /^check-.*\.mjs$/.test(f))
  .filter((f) => !ALLOW.some((a) => a.re.test(f)));

/**
 * preflight が記録した出力を使う(`--from-cache`)。
 *
 * **全検査を叩き直すと preflight が実質 2 倍になる。** この検査は 60 本以上を
 * 実行して出力を見るので、preflight から呼ばれると同じものを 2 回走らせていた
 * (実測 196 秒。2026-08)。**引き継ぐ人が最初に叩くコマンド**なので、
 * 遅いと信用されない。preflight は既に各検査の出力を持っているので、それを渡す。
 *
 * 単体で実行するとき(`node tools/check-scan-reporting.mjs`)は従来どおり自分で走らせる。
 */
const cachePath = path.join(ROOT, "node_modules", ".cache", "preflight-outputs.json");
const cache = (() => {
  if (!process.argv.includes("--from-cache") || !existsSync(cachePath)) return null;
  // **古いキャッシュは使わない。** `node_modules/.cache` は消えにくいので、
  // 前回の実行結果が残る。検査を直した後に古い出力で判定されると、
  // **直したのに落ちる / 直っていないのに通る**という形になる。
  // preflight は毎回書き直すので、5 分以内なら「今回のもの」とみなせる。
  const age = Date.now() - statSync(cachePath).mtimeMs;
  if (age > 5 * 60 * 1000) return null;
  return JSON.parse(readFileSync(cachePath, "utf8"));
})();

const silent = [];
/** 数は出しているが、すべて 0 の検査(何も見ていない)。 */
const zeros = [];
let ok = 0;

for (const tool of tools) {
  const name = tool.replace(/\.mjs$/, "");
  const hit = cache?.[name];
  const r = hit ?? spawnSync(process.execPath, [path.join(TOOLS, tool)], {
    cwd: ROOT, encoding: "utf8", timeout: 120000,
  });
  const out = hit ? hit.out : `${r.stdout ?? ""}${r.stderr ?? ""}`;
  // **失敗した検査は対象外。** 違反の一覧が出るのが正しく、
  // ここで数を求めると「落ちている検査を直す」より先に体裁を整えることになる
  if (r.status !== 0) continue;
  // 成功の行に数が含まれているか
  // **`⏭`(skip)も見る。** skip は「対象が無い」という報告なので、
  // **何件見て 0 だったのか**が要る——数が無いと、
  // 「まだ回していない」のか「対象を取り違えている」のか区別できない
  // (2026-08、`check-bundle-size` / `check-licenses` がその形だった)。
  const summary = out.split("\n").filter((l) => l.includes("✅") || l.includes("⚠") || l.includes("⏭")).join(" ");
  const numbers = [...summary.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  if (numbers.length > 0) {
    // **数はあるが、すべて 0 なら「何も見ていない」。**
    // 走査対象が 0 件でも「✅ 違反はありません(0 ファイルを検査)」と出て通る。
    // 対象の指定を間違えた検査は、この形で**永久に緑のまま**になる
    // (`check-api-error-shape` がアプリ名を手書きして showcase 17 件を
    //  取りこぼしたときも、件数は出ていたが誰も読まなかった)。
    // **skip は「0 件」でよい。** 依存やビルド結果が無い環境では
    // 対象が 0 になるのが正しく、**それを報告している**のだから合格。
    // 見たいのは「緑なのに 0 件」——**対象の指定を間違えた検査**である
    const skipped = out.includes("⏭");
    if (!skipped && numbers.every((n) => n === 0)) {
      zeros.push(tool);
      continue;
    }
    ok += 1;
    continue;
  }
  silent.push(tool);
}

if (silent.length === 0 && zeros.length === 0) {
  console.log(`✅ 検査はすべて走査量を報告しています(${ok} 件を確認)`);
  process.exit(0);
}
for (const z of zeros) {
  console.error(`❌ tools/${z}: 走査量がすべて 0 です(対象を 1 件も見ていません)`);
}
for (const s of silent) console.error(`❌ tools/${s}: 成功時の出力に数が含まれていません`);
console.error(`\n${silent.length + zeros.length} 件。**緑の検査は読まれないので、対象が縮んでも気づけません。**`);
console.error("「何件見たか」を出してください(書式は問いません)。");
console.error("数える対象が無い検査は ALLOW に理由付きで登録すること。");
process.exit(1);
