/**
 * **アプリが自前でグラフを描いていないか**を検出する。
 *   node tools/check-handmade-chart.mjs
 *   node tools/check-handmade-chart.mjs --list        (該当箇所の一覧)
 *   node tools/check-handmade-chart.mjs --set-limit   (減らしたら上限を下げる)
 *
 * 【なぜ必要か】
 * `@platform/ui` には棒・折れ線・複合・円・散布図など **20 のグラフ部品**がある。
 * にもかかわらず、主力の internal-app は**基盤のグラフを 1 つも使わず**、
 * インライン SVG で棒グラフや折れ線を手書きしていた(4 画面)。
 *
 * さらに悪いことに、AI が読む定型集 `docs/ai/patterns.md` が
 * 「グラフは外部ライブラリを使わずインライン SVG」と**推奨していた**。
 * この基盤が最も潰したい「車輪の再発明」が、作法として書かれていた形になる。
 *
 * `check-reimplementation` は**関数名の一致**しか見ないため、`TrendChart` のように
 * 基盤と違う名前を付けた再実装は素通りする。名前ではなく**書き方**で捕まえる。
 *
 * 【手書きの何が問題か】
 *   - 目盛・凡例・ツールチップ・レスポンシブを毎回作り直す(そして毎回抜ける)
 *   - 色を直書きしがちで、テーマ切り替えに追従しない
 *   - 実際に基盤側のグラフでは軸が Fragment に包まれて消えるバグがあったが、
 *     手書き側は**そもそも軸が無い**ため、直しても恩恵を受けられない
 *
 * 【判定】
 * `.tsx` の中で、次を**すべて**満たすものを「手書きグラフ」とみなす:
 *   1. `<svg` がある
 *   2. 図形(`polyline`/`rect`/`circle`/`path`/`line`)の属性に式が埋まっている(データ駆動)
 *   3. `.map(` でデータを回している
 *   4. `viewBox` があり、`Math.max` などで**目盛りを自前計算**している
 *
 * アイコンや装飾の SVG は 2〜4 を満たさないので拾わない
 * (実測: 誤検出 0 件・該当 4 件)。
 *
 * 【上限つき(ラチェット)】
 * 既存 4 件は画面を動かしながら 1 つずつ移すもので、一括置換はできない。
 * **増やさないこと**だけを守る。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIMIT_FILE = path.join(ROOT, "tools", "handmade-chart-limit.json");

/** 図形の属性に式(`{...}`)が入っている = データから座標を作っている。 */
// **属性の長さの上限。** 2026-08 に 200 では**4 件が切れて見逃されていた**
// （最長 502 文字）——**長い `d` 属性を持つ `<path>` が対象外**になっていた。
// 余裕をもって 1,200 にしてある。
const DATA_DRIVEN_SHAPE = /<(polyline|rect|circle|path|line)\b[^>]{0,1200}\{/;
/** 目盛りを自前で計算している手がかり。 */
const OWN_SCALE = /Math\.max|Math\.min|\/\s*max\b/;

// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)
const files = collectFiles(["apps"], ROOT, { extensions: [".tsx"] })
  .filter((f) => f.includes("/src/"));

const hits = [];
for (const rel of files) {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  if (!text.includes("<svg")) continue;
  if (!DATA_DRIVEN_SHAPE.test(text)) continue;
  if (!text.includes(".map(")) continue;
  if (!text.includes("viewBox") || !OWN_SCALE.test(text)) continue;
  hits.push(rel);
}

const limit = existsSync(LIMIT_FILE) ? JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit : hits.length;

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({ limit: hits.length }, null, 2)}\n`);
  console.log(`✅ 上限を ${hits.length} に更新しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const f of hits) console.log(`  ${f}`);
}

if (hits.length > limit) {
  console.error(
    `❌ 自前で描いているグラフが ${hits.length} 件あります(上限 ${limit})。` +
    "\n   @platform/ui のグラフ部品を使ってください" +
    "(BarChart / LineChart / ComboChart / PieChart / ScatterChart ほか)。" +
    "\n   定型は docs/ai/patterns.md 5 章、動く実例は /charts デモ。" +
    "\n   一覧: node tools/check-handmade-chart.mjs --list",
  );
  for (const f of hits) console.error(`     ${f}`);
  process.exitCode = 1;
} else if (hits.length > 0) {
  console.log(
    `⚠ 自前で描いているグラフが ${hits.length} 件あります(上限 ${hits.length === limit ? limit : `${limit}・減少済み`})。` +
    " @platform/ui のグラフ部品へ順次移行してください",
  );
} else {
  console.log(`✅ グラフはすべて @platform/ui の部品で描かれています(${files.length} ファイルを検査)`);
}
