#!/usr/bin/env node
/**
 * **`.github/CODEOWNERS` の規則が、いまも効いているか**を見る。
 *
 * ```bash
 * node tools/check-codeowners.mjs
 * ```
 *
 * 【なぜ要るか】
 * GitHub は **存在しないパスの規則をエラーにせず、黙って無視します**。
 * つまり `tools/` を改名した瞬間に——
 *
 * > **「レビュー必須のはず」が、誰にも通知されない状態**になります。
 *
 * 画面には何も出ません。PR は普通にマージできます。
 * **気づくのは、レビューされていないものが本番に出たとき**です。
 *
 * 【何を見るか】
 *  1. 規則のパスに**実体があるか**（`*` を含むものは対象外）
 *  2. 所有者の書式（`@` で始まっているか）
 *  3. **基盤の要所に規則があるか**（`packages/` `tools/` `CLAUDE.md`）
 *
 * 【見られないこと】
 * **`@platform-team` が GitHub 上に実在するかは分かりません。**
 * チームが無ければ CODEOWNERS 全体が機能しませんが、それは
 * リポジトリの外の話なので、**人が確かめてください**
 * （Settings → Teams。`docs/ops/GITHUB_ACTIONS.md` に控えがあります）。
 *
 * @packageDocumentation
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, ".github/CODEOWNERS");

/**
 * **必ず所有者を決めておきたい場所。**
 *
 * ここが抜けると、**基盤の中身が誰のレビューも無しに変わります**。
 */
const MUST_COVER = ["/packages/", "/tools/", "/CLAUDE.md"];

if (!existsSync(FILE)) {
  console.error("\n❌ .github/CODEOWNERS がありません");
  console.error("   → 基盤の要所が、誰のレビューも無しに変わります");
  process.exit(1);
}

const problems = [];
const patterns = [];

for (const [i, raw] of readFileSync(FILE, "utf8").split("\n").entries()) {
  const line = raw.trim();
  if (line === "" || line.startsWith("#")) continue;
  const [pattern, ...owners] = line.split(/\s+/);
  if (pattern === undefined) continue;
  patterns.push(pattern);

  if (owners.length === 0) {
    problems.push(`${i + 1} 行目: ${pattern} に所有者がありません（規則として意味を持ちません）`);
    continue;
  }
  for (const o of owners) {
    if (!o.startsWith("@") && !o.includes("@")) {
      problems.push(`${i + 1} 行目: 所有者 "${o}" が @ で始まっていません（GitHub は黙って無視します）`);
    }
  }

  // `*` を含む規則は展開しない（当たるかどうかはファイル構成次第）
  if (pattern.includes("*")) continue;
  const target = pattern.replace(/^\//, "").replace(/\/$/, "");
  if (target !== "" && !existsSync(path.join(ROOT, target))) {
    problems.push(
      `${i + 1} 行目: ${pattern} に実体がありません`
      + "\n     → GitHub は**エラーにせず黙って無視**します。改名したなら規則も直してください",
    );
  }
}

// **コメントに書いた参照先も見る。**
//
// 2026-08 に `docs/ops/CI_FIRST_RUN.md` を指したまま、**その資料が別ファイルへ
// 統合されて消えていました**。設定手順を探しに行った人が行き止まりに当たります
// ——**規則より先に、説明の方が腐ります**（説明は誰の CI も落とさないので）。
for (const [i, raw] of readFileSync(FILE, "utf8").split("\n").entries()) {
  for (const m of raw.matchAll(/(docs\/[A-Za-z0-9_/.-]+\.md)/g)) {
    if (!existsSync(path.join(ROOT, m[1]))) {
      problems.push(`${i + 1} 行目: コメントが ${m[1]} を指していますが、その資料はありません`);
    }
  }
}

for (const need of MUST_COVER) {
  if (!patterns.some((p) => p === need || p === need.replace(/\/$/, ""))) {
    problems.push(
      `${need} の規則がありません`
      + "\n     → 基盤の要所が、誰のレビューも無しに変わります",
    );
  }
}

// **ひな形のままなら知らせる。**
//
// `@platform-team` は `docs/ops/GITHUB_ACTIONS.md` の手順で
// **自組織のチーム名に置き換える前提**の値です。置き換えないまま運用すると——
// GitHub は**実在しないチームを黙って無視**するので、
// **「Code Owners のレビュー必須」が誰にも当たりません**。
//
// **落とさず知らせるだけ**にしています（置き換えは組織ごとの作業で、
// リポジトリを配る時点では正しい状態だから）。
const placeholder = readFileSync(FILE, "utf8").includes("@platform-team");
if (placeholder) {
  console.log("⚠ CODEOWNERS の所有者が `@platform-team` のままです（ひな形の値）");
  console.log("   自組織のチーム名に置き換えてください（docs/ops/GITHUB_ACTIONS.md の手順 1）");
  console.log("   **置き換えないと、Code Owners のレビュー必須が誰にも当たりません**");
}

if (problems.length > 0) {
  console.error(`\n❌ CODEOWNERS に問題があります（${problems.length} 件）`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("\n   ※ 所有者のチームが GitHub 上に実在するかは、ここでは分かりません（人が確かめてください）");
  process.exit(1);
}

console.log(`✅ CODEOWNERS の規則はすべて実体を指しています（${patterns.length} 規則）`);
console.log("   ※ 所有者のチームが GitHub 上に実在するかは別途確認してください");
