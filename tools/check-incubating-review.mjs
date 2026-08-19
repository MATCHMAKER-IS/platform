#!/usr/bin/env node
/**
 * **incubating のまま置き去りになっていないか**を見る。
 *
 * ```bash
 * node tools/check-incubating-review.mjs
 * node tools/check-incubating-review.mjs --list  # 実戦での使われ方つきで一覧
 * ```
 *
 * 【なぜ要るか】
 * ADR 0023 で **tier**(`stable` / `incubating` / `deprecated`)を決めましたが、
 * **incubating から出る／捨てる判断のタイミング**は決めていませんでした。
 *
 * 何もしないと、こうなります:
 *
 * > **「使われていないが、消す判断もされていない」パッケージが増える。**
 *
 * 増えると:
 * - `pnpm suggest` の候補が増え、**本当に使うべきものが埋もれる**
 * - 引き継いだ人が「これは使ってよいのか」を毎回考える
 * - 依存の更新・型検査・テストの時間だけがかかり続ける
 *
 * **消すのが正解とは限りません。** 「日本の業務を一級市民に」という方針上、
 * **まだ使っていないが、必要になったときに無いと困るもの**(全銀・電帳法など)は
 * 抱えておく価値があります。**判断を先送りしないこと**が目的です。
 *
 * 【判定】
 * 各 incubating に **`platform.incubatingSince`**(YYYY-MM)を求めます。
 * 無ければ「いつからか分からない＝判断のしようがない」ので指摘します。
 *
 * **`incubatingReviewedAt`(最後に見直した年月)から 12 か月**を超えたら、
 * もう一度見てくださいと言います。**落とすのは「見直しの記録が古い」ときだけ**で、
 * **incubating のままでいることは咎めません**——急かすと、
 * 中身を見ないまま `stable` に上げられます(それが一番まずい)。
 *
 * 【tier の意味(ADR 0023)】
 *
 * | tier | 意味 |
 * |---|---|
 * | `stable` | **形を変えない**。使ってよい。`incubating` に依存できない |
 * | `incubating` | **形が変わりうる**。使うなら、変わることを承知で |
 * | `deprecated` | 新しく使わない。代替がある |
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKGS = path.join(ROOT, "packages");

const list = process.argv.includes("--list");
const setReviewed = process.argv.includes("--mark-reviewed");

/** 見直しの間隔(月)。**短くしないこと** ——急かすと中身を見ずに上げられる。 */
const REVIEW_MONTHS = 12;

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "generated", "coverage"]);

/** そのパッケージがどこで使われているかを数える。 */
function countUsage(names) {
  const use = Object.fromEntries(names.map((n) => [n, { app: 0, showcase: 0, pkg: 0 }]));
  const walk = (dir, kind) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, kind); continue; }
      if (!/\.(ts|tsx)$/.test(e.name) || /\.test\./.test(e.name)) continue;
      const body = readFileSync(full, "utf8");
      // **コメントを落としてから数える。** 「リンクの検証には `@platform/url` を
      // 使うこと」のような**注意書きまで「利用」と数えて**しまい、
      // 使っていないパッケージが「実戦で使用中」に見えていた(2026-08)。
      // **数字が実態とずれると、棚卸しの判断そのものが狂う。**
      const code = body
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/[^\n]*$/gm, "");
      for (const n of names) {
        // import 文だけを見る(文字列としての言及は数えない)
        const re = new RegExp(`from\\s+["'\`]${n.replace("/", "\\/")}(/[^"'\`]*)?["'\`]`);
        if (re.test(code)) use[n][kind] += 1;
      }
    }
  };
  const appsDir = path.join(ROOT, "apps");
  if (existsSync(appsDir)) {
    for (const a of readdirSync(appsDir, { withFileTypes: true })) {
      if (!a.isDirectory()) continue;
      walk(path.join(appsDir, a.name, "src"), a.name === "showcase" ? "showcase" : "app");
    }
  }
  walk(PKGS, "pkg");
  return use;
}

const dirs = readdirSync(PKGS, { withFileTypes: true }).filter((e) => e.isDirectory());
const incubating = [];
for (const d of dirs) {
  const p = path.join(PKGS, d.name, "package.json");
  if (!existsSync(p)) continue;
  const json = JSON.parse(readFileSync(p, "utf8"));
  if (json.platform?.tier !== "incubating") continue;
  incubating.push({ dir: d.name, name: json.name, meta: json.platform, path: p, json });
}

const usage = countUsage(incubating.map((i) => i.name));

/** `YYYY-MM` からの経過月数。 */
function monthsSince(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  if (m === null) return null;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

if (setReviewed) {
  for (const i of incubating) {
    const next = {
      ...i.json,
      platform: {
        ...i.meta,
        incubatingSince: i.meta.incubatingSince ?? today,
        incubatingReviewedAt: today,
      },
    };
    writeFileSync(i.path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  console.log(`✅ ${incubating.length} 件に見直しの記録を付けました(${today})`);
  console.log("   **中身を見ずに実行しないこと。** これは「見た」という記録です");
  process.exit(0);
}

const rows = incubating.map((i) => {
  const u = usage[i.name];
  const real = u.app + u.pkg;
  return {
    ...i,
    real,
    showcase: u.showcase,
    since: i.meta.incubatingSince,
    reviewed: i.meta.incubatingReviewedAt,
    age: monthsSince(i.meta.incubatingReviewedAt ?? i.meta.incubatingSince),
  };
});

if (list) {
  console.log(`incubating ${rows.length} 件(実戦 = showcase 以外での利用):\n`);
  for (const r of [...rows].sort((a, b) => a.real - b.real)) {
    const state = r.real > 0 ? "実戦で使用中" : r.showcase > 0 ? "見本のみ" : "**どこでも未使用**";
    console.log(`  ${r.name}`);
    console.log(`    ${state}(実戦 ${r.real} / 見本 ${r.showcase})  開始 ${r.since ?? "不明"}  最終見直し ${r.reviewed ?? "なし"}`);
  }
  console.log("");
  console.log("判断の目安:");
  console.log("  実戦で使用中 … `stable` へ上げる(形を変えないと約束できるか)");
  console.log("  見本のみ    … **必要になったときに無いと困るか**。困るなら残す(理由を README に)");
  console.log("  未使用      … 消すか、残す理由を書く");
  process.exit(0);
}

const noSince = rows.filter((r) => r.since === undefined);
const stale = rows.filter((r) => r.age !== null && r.age >= REVIEW_MONTHS);

if (noSince.length === 0 && stale.length === 0) {
  console.log(`✅ incubating の棚卸しは最新です(${rows.length} 件 / 見直しの間隔 ${REVIEW_MONTHS} か月)`);
  process.exit(0);
}

console.error("❌ incubating の棚卸しが必要です:");
if (noSince.length > 0) {
  console.error(`\n   いつから incubating か記録がない(${noSince.length} 件):`);
  for (const r of noSince.slice(0, 10)) console.error(`     ${r.name}`);
  if (noSince.length > 10) console.error(`     …ほか ${noSince.length - 10} 件`);
  console.error("     → package.json の `platform.incubatingSince` に `YYYY-MM` を書いてください");
}
if (stale.length > 0) {
  console.error(`\n   ${REVIEW_MONTHS} か月以上見直していない(${stale.length} 件):`);
  for (const r of stale.slice(0, 10)) {
    console.error(`     ${r.name}(最終 ${r.reviewed ?? r.since} / 実戦 ${r.real} / 見本 ${r.showcase})`);
  }
}
console.error("");
console.error("   一覧と判断の目安: node tools/check-incubating-review.mjs --list");
console.error("   見直したら:       node tools/check-incubating-review.mjs --mark-reviewed");
console.error("");
console.error("   **incubating のままでよい**ものもあります(必要になったときに無いと困るもの)。");
console.error("   咎めているのは「判断を先送りしていること」だけです。");
process.exit(1);
