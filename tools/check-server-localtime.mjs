/**
 * **サーバ側でローカル時刻のメソッドを使っていないか。**
 *
 * 【なぜ要るか】
 * `getFullYear()` / `getHours()` / `setDate()` などは**サーバのローカル時刻**で動く。
 * クラウドの既定は UTC なので、**JST の 00:00〜08:59 が前日**として扱われ、
 * 日付や曜日、時刻が 1 日ないし 9 時間ずれる。
 *
 * 2026-08 に 7 件見つかった——見積の有効期限(失効した価格で受注)、
 * 通知の静音時間(**夜中に鳴り昼間は届かない**)、電帳法の保存期限(法令違反)、
 * 予約の曜日判定(日曜定休の店で月曜朝が取れない)など。
 *
 * **CI は UTC なので、テストでも気づけない。**
 *
 * 【対象外】
 * **`.tsx`(ブラウザ側)は正しい**——利用者の時刻を見るのが本来の動作。
 * サーバで動くコード(`.ts`)だけを見る。
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/source-text.mjs";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ローカル時刻で動くメソッド(UTC 版がある)。 */
const LOCAL_METHODS = /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setFullYear|setMonth|setDate|setHours)\(/;

/**
 * 見逃してよい箇所。
 *
 * **理由を必ず書く。** 「なんとなく」で足すと、この検査の意味が無くなる。
 */
const ALLOW = [
  { re: /^datetime\/src\//, why: "TZ 変換そのものを実装している。UTC メソッドと併用するのが正しい" },
  {
    re: /^ui\/src\//,
    why:
      "**ブラウザで動く部品**。`.tsx` は既に対象外だが、"
      + "`ui/src/lib/*.ts`(表示の純ロジック)も**利用者の端末で動く**ので、"
      + "ローカル時刻を見るのが正しい——カレンダーや予定表は"
      + "**その人の時計で描く**もの。ここを数えると、"
      + "**直しようのない件数**が上限に居座り、本当のサーバ側の問題が埋もれる(2026-08)",
  },
  {
    re: /\.generated\.ts$/,
    why:
      "**自動生成物**。手で直せず、直しても次の生成で戻る。"
      + "直すなら**生成する側**(`tools/gen-*.mjs`)——ここで数えても直せない",
  },
  {
    re: /\/seed\.ts$/,
    why:
      "初期データの投入。**開発者が手元で 1 回叩くもの**で、"
      + "1 日ずれても業務に影響しない(投入し直せる)",
  },
];

const files = collectFiles(["packages", "apps"], ROOT, {
  // **`.tsx` は対象外**(ブラウザ側は利用者の時刻で正しい)
  extensions: [".ts"],
}).filter((f) => !/\.test\.ts$/.test(f));

const hits = [];
let scanned = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/").replace(/^(packages|apps)\//, "");
  if (ALLOW.some((a) => a.re.test(rel))) continue;
  scanned += 1;
  const code = stripComments(fs.readFileSync(file, "utf8"));
  code.split("\n").forEach((line, i) => {
    const m = LOCAL_METHODS.exec(line);
    if (!m) return;
    // **`todayJst(...)` / `jstDate(...)` の直後は対象外。**
    // それらは**すでに JST に寄せた Date** を返すので、
    // `getFullYear()` で JST の年が取れるのが正しい。
    // ここを弾かないと、**正しく直したコードが直後にまた指摘される**——
    // 「直しても赤いまま」になると、検査を信じなくなる(2026-08)
    // **`[^)]*` は使わない。** `todayJst(new Date())` のように
    // **引数に `)` が入ると途中で切れます**(`check-regex-pitfalls` の指摘)。
    // 関数名の直後から行末までに `.getXxx(` が続くかだけを見れば足りる
    if (/\b(todayJst|jstDate|toJst)\(/.test(line)) return;
    hits.push(`${rel}:${i + 1} ${m[1]}()`);
  });
}

// **上限方式にする。** アプリ側に 31 件あり、一度に直すと差分が大きすぎる。
// **増やさないこと**を守り、触るときに減らす(2026-08)。
const limitFile = path.join(ROOT, "tools", "server-localtime-limit.json");
const limit = (() => {
  try { return JSON.parse(fs.readFileSync(limitFile, "utf8")).limit; } catch { return 0; }
})();

// **一覧を出せるようにする。**
// **上限方式の検査には必ず `--list` を付けてください**——
// **どれが対象か分からないと、減らせません**（上限を守るだけになります）。
if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h}`);
  console.log(`   （${hits.length} 件）`);
  process.exit(0);
}

if (process.argv.includes("--set-limit")) {
  fs.writeFileSync(limitFile, `${JSON.stringify({ limit: hits.length, updatedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`);
  console.log(`上限を ${hits.length} に設定しました`);
  process.exit(0);
}

if (hits.length > limit) {
  console.log(`❌ サーバ側でローカル時刻のメソッドを使う箇所が ${hits.length} 件に増えました(上限 ${limit}):`);
  for (const h of hits.slice(0, 20)) console.log(`   ${h}`);
  if (hits.length > 20) console.log(`   ...他 ${hits.length - 20} 件`);
  console.log("");
  console.log("   **UTC のサーバでは JST の 00:00〜08:59 が前日**になります。");
  console.log("   9 時間ずらして UTC メソッドで読むか、`@platform/datetime` を使ってください。");
  process.exit(1);
}
console.log(`✅ サーバ側のローカル時刻の利用は ${hits.length} 件(上限 ${limit} / ${scanned} ファイルを検査)`);
if (hits.length < limit) {
  console.log(`   **上限を下げてください**(\`node tools/check-server-localtime.mjs --set-limit\`)。`);
  console.log("   下げないと、その分だけ後戻りが素通りします。");
}
