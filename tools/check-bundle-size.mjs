#!/usr/bin/env node
/**
 * **画面を開いたときに読み込む JavaScript の量**を見張る(上限ラチェット)。
 *
 * ```bash
 * node tools/check-bundle-size.mjs             # 上限を超えたら失敗
 * node tools/check-bundle-size.mjs --list      # ページごとの実測
 * node tools/check-bundle-size.mjs --set-limit # いまの実測を上限に刻む
 * ```
 *
 * 【なぜ要るか】
 * **JS は黙って増える。** 便利なライブラリを 1 つ入れるたびに数十 KB 増え、
 * **どれが効いたか分からないまま**重くなる。気づくのは
 * 「最近このシステム遅くない?」と言われたときで、**そこから減らすのは難しい**。
 *
 * 社内システムでも効きます:
 *
 * | | |
 * |---|---|
 * | **拠点の回線が細い** | 工場・店舗は光でないことがある。1MB の JS は体感で数秒 |
 * | **古い端末** | 解析と実行に時間がかかる。ダウンロードより遅いことも |
 * | **毎日何十回も開く** | 1 回 2 秒でも、**20 人 × 30 回 = 1 日 20 分**が消える |
 *
 * 【判定】
 * `next build` が出す `.next/app-build-manifest.json` から、
 * **ページごとの初期 JS**(そのページを開くのに必要なファイルの合計)を測り、
 * `tools/bundle-size-limit.json` の上限と比べる。
 *
 * **絶対値の目標は置かない。** いきなり「200KB 以内」にすると全ページが赤になり、
 * 止まった CI は無効化される(カバレッジで同じ失敗をしている)。
 * **いまの値を上限に刻み、増えたら落とす**。減ったら `--set-limit` で締める。
 *
 * 【この検査がしないこと】
 * - **画像や CSS は見ない**(JS だけ)
 * - **実際の表示速度は測らない**。回線と端末で変わるので、ここでは量だけを見る
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "bundle-size-limit.json");

const list = process.argv.includes("--list");
const setLimit = process.argv.includes("--set-limit");

/** 対象アプリ(ビルド済みのものだけ見る)。 */
const APPS = existsSync(path.join(ROOT, "apps"))
  ? readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

/**
 * ページごとの初期 JS を測る。
 *
 * @param app アプリ名
 * @returns `{ ページ: バイト数 }`。ビルドされていなければ null
 */
function measure(app) {
  const next = path.join(ROOT, "apps", app, ".next");
  const manifest = path.join(next, "app-build-manifest.json");
  if (!existsSync(manifest)) return null;

  const { pages } = JSON.parse(readFileSync(manifest, "utf8"));
  if (pages === undefined) return null;

  const sizes = {};
  for (const [route, files] of Object.entries(pages)) {
    let total = 0;
    for (const f of files) {
      if (!f.endsWith(".js")) continue;
      const full = path.join(next, f);
      if (!existsSync(full)) continue;
      total += statSync(full).size;
    }
    sizes[route] = total;
  }
  return sizes;
}

const measured = {};
for (const app of APPS) {
  const sizes = measure(app);
  if (sizes !== null) measured[app] = sizes;
}

if (Object.keys(measured).length === 0) {
  // **skip でも数を出す。** 「何も見ていない」ことが分かるようにしておかないと、
  // 緑の行と区別がつかない(`check-scan-reporting` の趣旨)
  console.log(`⏭  check-bundle-size は skip しました(ビルド結果 0 件 / アプリ ${APPS.length} 件を確認)。\`pnpm build\` の後に回してください`);
  console.log("   ※ CI では build 後に走ります");
  process.exit(0);
}

const kb = (n) => `${Math.round(n / 1024)}KB`;

if (list) {
  for (const [app, sizes] of Object.entries(measured)) {
    console.log(`\n${app}:`);
    const rows = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
    for (const [route, size] of rows.slice(0, 20)) {
      console.log(`  ${kb(size).padStart(7)}  ${route}`);
    }
    const max = rows[0];
    if (max !== undefined) console.log(`  → 最大 ${kb(max[1])}(${max[0]})`);
  }
  process.exit(0);
}

/** アプリごとの「最大ページ」だけを刻む。**全ページを刻むと差分が読めない**。 */
const current = {};
for (const [app, sizes] of Object.entries(measured)) {
  const rows = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
  const top = rows[0];
  if (top !== undefined) current[app] = { maxBytes: top[1], route: top[0] };
}

if (setLimit) {
  const next = {
    note:
      "ページごとの初期 JS の上限(バイト)。**増やす方向に手で書き換えないこと。**"
      + "増やしたいときは、なぜ増えるのかを PR の説明に書いてから --set-limit で刻む。",
    apps: current,
  };
  writeFileSync(LIMIT_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`✅ 上限を刻みました: ${path.relative(ROOT, LIMIT_FILE)}`);
  for (const [app, v] of Object.entries(current)) {
    console.log(`   ${app}: ${kb(v.maxBytes)}(${v.route})`);
  }
  process.exit(0);
}

if (!existsSync(LIMIT_FILE)) {
  console.log(`⏭  check-bundle-size は skip しました(上限が未設定。計測できたアプリ ${Object.keys(current).length} 件)。`);
  console.log("   `pnpm build` の後に `node tools/check-bundle-size.mjs --set-limit` で刻んでください");
  process.exit(0);
}

const limit = JSON.parse(readFileSync(LIMIT_FILE, "utf8"));
const over = [];
for (const [app, v] of Object.entries(current)) {
  const l = limit.apps?.[app];
  if (l === undefined) continue;
  if (v.maxBytes > l.maxBytes) {
    over.push({ app, now: v.maxBytes, was: l.maxBytes, route: v.route });
  }
}

if (over.length === 0) {
  const shown = Object.entries(current).map(([a, v]) => `${a} ${kb(v.maxBytes)}`).join(" / ");
  console.log(`✅ 初期 JS は上限内(${Object.keys(current).length} アプリ: ${shown})`);
  process.exit(0);
}

console.error(`❌ 初期 JS が上限を超えました(${over.length} アプリ):`);
for (const o of over) {
  const diff = o.now - o.was;
  console.error(`   ${o.app}: ${kb(o.was)} → ${kb(o.now)}(+${kb(diff)})  最大は ${o.route}`);
}
console.error("");
console.error("   **何を入れたら増えたか**を確かめてください:");
console.error("     node tools/check-bundle-size.mjs --list");
console.error("");
console.error("   よくある原因と対処:");
console.error("     ・重いライブラリを画面から直接 import している → 動的 import(`next/dynamic`)にする");
console.error("     ・サーバでよい処理がクライアント側にある → `\"use client\"` の範囲を狭める");
console.error("     ・アイコンや地域データを一括 import している → 使うものだけ import する");
console.error("");
console.error("   **増やすと決めたなら**、理由を PR に書いてから刻み直してください:");
console.error("     node tools/check-bundle-size.mjs --set-limit");
process.exit(1);
