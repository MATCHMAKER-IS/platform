#!/usr/bin/env node
/**
 * **上限方式で先送りしている件数(残債)を、一箇所に集めて推移を追う。**
 *
 * 【なぜ要るか】
 * この基盤は「検査を足す」ところまではよくできているが、
 * **検査が見つけたものを消化する段が無い**。上限方式は増加を止めるだけで、
 * 既存分は放っておけば永久に残る。実際にこうなっていた:
 *
 *  - `check-tsdoc-params` の P4 は、**追加した時点の 92 件がそのまま上限**になった
 *  - そのうち 20 件は zoho の `config.dc`(正しくは `dataCenter`)で、
 *    **P4 検査を追加した動機そのもの**だったのに手つかずで残っていた
 *  - 検査は毎回 `⚠`(上限内)を出すが preflight は緑なので、**誰も読まない**
 *
 * つまり「見つける」と「直す」の間が切れている。ここを埋めるのがこのツール。
 *
 * 【何をするか】
 *  1. 残債を 1 つの表にする(`pnpm debt`)。どこを見ればよいかを毎回示す
 *  2. **たるみを検出する**。直したのに上限を下げ忘れると、
 *     その分だけ後戻りが素通りする。上限方式の穴はここしかない
 *  3. 推移を `ops/debt-history.json` に記録し、**動いていない項目を名指しする**。
 *     減らないこと自体は責めない(優先度の判断がある)。
 *     ただし「気づかないうちに何か月も止まっていた」は防ぐ
 *
 * **順位は付けない。** 何から手を付けるかは中身を見た人が決める。
 * 機械が決められるのは「今いくつあるか」「動いているか」までで、
 * そこを取り違えると、直しやすいものだけが消えて危険なものが残る。
 *
 * 実行:
 *   node tools/debt.mjs              一覧と推移を表示
 *   node tools/debt.mjs --record     今日の値を履歴に記録する
 *   node tools/debt.mjs --tighten    たるみ(実測 < 上限)を詰める
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY = path.join(ROOT, "ops", "debt-history.json");
const RECORD = process.argv.includes("--record");
const TIGHTEN = process.argv.includes("--tighten");

/**
 * 追いかける残債。
 *
 * **上限ファイルを直接読む**(検査の出力を文字列で拾わない)。
 * 出力の言い回しが変わるたびに壊れる作りにすると、
 * 「残債を追う仕組みが残債になる」。
 */
const ITEMS = [
  { key: "api-auth", file: "tools/api-auth-limit.json", field: "limit",
    what: "認可も公開宣言も無い API", how: "node tools/check-api-auth.mjs" },
  { key: "app-bypass", file: "tools/app-bypass-limit.json", field: "limit",
    what: "基盤を使わず自作している箇所", how: "node tools/check-app-rules.mjs --bypass" },
  { key: "handmade-chart", file: "tools/handmade-chart-limit.json", field: "limit",
    what: "自前で描いたグラフ", how: "node tools/check-handmade-chart.mjs" },
  { key: "colors", file: "tools/hardcoded-colors-limit.json", field: "limit",
    what: "基盤に直書きされた色", how: "node tools/check-hardcoded-colors.mjs" },
  { key: "colors-app", file: "tools/hardcoded-colors-app-limit.json", field: "limit",
    what: "アプリに直書きされた色", how: "node tools/check-hardcoded-colors.mjs" },
  { key: "reimplementation", file: "tools/reimplementation-limit.json", field: "limit",
    what: "基盤と同名の再実装", how: "node tools/check-reimplementation.mjs" },
  { key: "utc-date", file: "tools/utc-date-limit.json", field: "limit",
    what: "UTC で日付を切り出している箇所", how: "node tools/check-utc-date.mjs" },
  { key: "ui-raw-tag", file: "tools/ui-raw-tag-limit.json", field: "limit",
    what: "部品を使わない生タグ", how: "node tools/check-app-rules.mjs" },
  { key: "big-files", file: "tools/maintainability-limit.json", field: "bigFiles",
    what: "600 行超のファイル", how: "node tools/check-maintainability.mjs" },
  { key: "long-lines", file: "tools/maintainability-limit.json", field: "longLines",
    what: "200 文字超の行", how: "node tools/check-maintainability.mjs" },
  { key: "ime-enter", file: "tools/ime-enter-limit.json", field: "limit",
    what: "変換中を見ずに Enter を拾う箇所(日本語で誤送信)",
    how: "node tools/check-ime-enter.mjs --list" },
  { key: "css-vars", file: "tools/css-vars-limit.json", field: "limit",
    what: "定義されていない CSS 変数の参照(テーマが効かない)",
    how: "node tools/check-css-vars.mjs" },
  { key: "tsdoc-p2", file: "tools/tsdoc-params-limit.json", field: "p2",
    what: "実装に無い引数の説明", how: "node tools/check-tsdoc-params.mjs --list" },
  { key: "tsdoc-p3", file: "tools/tsdoc-params-limit.json", field: "p3",
    what: "引数名だけの違い", how: "node tools/check-tsdoc-params.mjs --list" },
  { key: "api-error-shape", file: "tools/api-error-shape-limit.json", field: "limit",
    what: "traceId を返さないルート(例外が拾われず 500 になる)",
    how: "node tools/check-api-error-shape.mjs --list" },
  { key: "tsdoc-p4", file: "tools/tsdoc-params-limit.json", field: "p4",
    what: "存在しないプロパティの説明", how: "node tools/check-tsdoc-params.mjs --list" },
];

/**
 * たるみを詰めるコマンド。**フラグは検査ごとに違う**
 * (`check-app-rules` の bypass 分だけ `--set-bypass-limit`)。
 * `--set-limit` で揃っていると思い込むと、その上限だけ永久に緩んだまま残る。
 */
const TIGHTENERS = [
  ["check-api-auth", "--set-limit"],
  ["check-app-rules", "--set-limit"],
  ["check-app-rules", "--set-bypass-limit"],
  ["check-handmade-chart", "--set-limit"],
  ["check-hardcoded-colors", "--set-limit"],
  ["check-maintainability", "--set-limit"],
  ["check-reimplementation", "--set-limit"],
  ["check-tsdoc-params", "--set-limit"],
  ["check-utc-date", "--set-limit"],
  ["check-api-error-shape", "--set-limit"],
  ["check-css-vars", "--set-limit"],
  ["check-ime-enter", "--set-limit"],
];

function readLimits() {
  const out = [];
  for (const it of ITEMS) {
    const p = path.join(ROOT, it.file);
    if (!existsSync(p)) continue;
    const json = JSON.parse(readFileSync(p, "utf8"));
    const v = json[it.field];
    if (typeof v !== "number") continue;
    out.push({ ...it, limit: v });
  }
  return out;
}

const today = new Date().toISOString().slice(0, 10);

// ── たるみを詰める ──
if (TIGHTEN) {
  const before = Object.fromEntries(readLimits().map((i) => [i.key, i.limit]));
  for (const [t, flag] of TIGHTENERS) {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", `${t}.mjs`), flag],
      { cwd: ROOT, encoding: "utf8" });
    if (r.status !== 0 && r.status !== null) console.error(`   (${t} ${flag} で失敗)`);
  }
  const after = readLimits();
  let moved = 0;
  for (const i of after) {
    if (before[i.key] !== undefined && i.limit < before[i.key]) {
      console.log(`✔ ${i.key}: ${before[i.key]} → ${i.limit}(たるみを詰めました)`);
      moved += 1;
    }
  }
  console.log(moved === 0
    ? "✅ たるみはありません(上限と実測が一致しています)"
    : `\n${moved} 件のたるみを詰めました。**このまま commit してください**` +
      "(下げないと、その分だけ後戻りが素通りします)");
  process.exit(0);
}

const items = readLimits();
const history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, "utf8")) : { entries: [] };
const prev = history.entries.at(-1) ?? null;

// ── 記録する ──
if (RECORD) {
  const snapshot = { date: today, values: Object.fromEntries(items.map((i) => [i.key, i.limit])) };
  // 同じ日に 2 回流しても増やさない(上書き)
  if (prev && prev.date === today) history.entries[history.entries.length - 1] = snapshot;
  else history.entries.push(snapshot);
  mkdirSync(path.dirname(HISTORY), { recursive: true });
  writeFileSync(HISTORY, `${JSON.stringify(history, null, 2)}\n`);
  console.log(`✅ ${today} の残債を記録しました(${HISTORY.replace(ROOT + path.sep, "")})`);
  process.exit(0);
}

// ── 一覧 ──
const open = items.filter((i) => i.limit > 0);
const done = items.filter((i) => i.limit === 0);
const total = open.reduce((a, i) => a + i.limit, 0);

console.log(`▶ 残債(上限方式で先送りしている件数)  合計 ${total} 件 / 未消化 ${open.length} 項目\n`);

if (open.length === 0) {
  console.log("  ✅ 残債はありません。");
} else {
  for (const i of open) {
    // **いつの値と比べたかを示す。** 「減った」だけでは、
    // 昨日と比べたのか半年前と比べたのか分からない
    const before = prev?.values?.[i.key];
    let trend = "  (履歴なし)";
    if (typeof before === "number") {
      const d = i.limit - before;
      trend = d === 0 ? `  → ${prev.date} から動いていません`
        : d < 0 ? `  ↓ ${prev.date} から ${-d} 件 減` : `  ↑ ${prev.date} から ${d} 件 増`;
    }
    console.log(`  ${String(i.limit).padStart(5)}  ${i.what}${trend}`);
    console.log(`         中身を見る: ${i.how}`);
  }
}

if (done.length > 0) {
  console.log(`\n  消化済み(上限 0・後戻りは検査が止めます): ${done.map((d) => d.what).join(" / ")}`);
}

console.log("\n減らしたら **必ず `node tools/debt.mjs --tighten`** を流してください。");
console.log("上限を下げないと、直した分だけ後戻りが素通りします。");
if (history.entries.length === 0) {
  console.log("履歴がまだありません。`node tools/debt.mjs --record` で今日の値を記録できます。");
}
