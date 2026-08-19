#!/usr/bin/env node
/**
 * dev サーバを起動する前に、古いビルドを片付ける(predev)。
 *
 * 【なぜ自動でやるか】
 * Next は基盤パッケージ(`packages/`)を取り込んでビルドし、
 * **その結果が `.next` に残る**。パッケージ側を直しても作り直されないことがあり、
 * 削除済みのコードが動き続ける。
 *
 * 症状が分かりにくいのが厄介で、
 * **「画面は出るがボタンが何も反応しない」**(ハイドレーションが失敗し、
 * React がイベントを結び付けられない)という形で出る。
 * エラーを読んでも「古いビルド」とは書かれていない。
 *
 * 2026-08、この状態に何度も遭遇した。毎回 `pnpm dev:clean` を
 * 覚えておくのは現実的でないので、**起動のたびに自動で判定する**。
 *
 * 【消しすぎない】
 * `packages/` より新しければ何もしない。毎回消すと初回表示が
 * 数十秒遅くなり、開発のテンポが落ちる。
 */
import { existsSync, readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// このスクリプトはアプリのディレクトリで実行される(package.json の predev)
const APP_DIR = process.cwd();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ディレクトリ内で最も新しいソースの更新時刻。 */
function newestSource(dir, depth = 0) {
  if (depth > 4) return 0;
  let max = 0;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    if (["node_modules", ".next", "dist", "generated"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) max = Math.max(max, newestSource(p, depth + 1));
    else if (/\.(ts|tsx|css)$/.test(e.name)) {
      try { max = Math.max(max, statSync(p).mtimeMs); } catch { /* noop */ }
    }
  }
  return max;
}

const nextDir = path.join(APP_DIR, ".next");
if (!existsSync(nextDir)) process.exit(0);

const packagesDir = path.join(ROOT, "packages");
if (!existsSync(packagesDir)) process.exit(0);

let built = 0;
try { built = statSync(nextDir).mtimeMs; } catch { process.exit(0); }

if (built >= newestSource(packagesDir)) process.exit(0);

// **古い。** 消してから起動させる
console.log("");
console.log("▶ 基盤パッケージを直した後のビルドが残っているため、.next を消します");
console.log("  (残すと『画面は出るがボタンが反応しない』状態になります)");
console.log("  初回の表示は少し時間がかかります。");
console.log("");
try {
  rmSync(nextDir, { recursive: true, force: true });
} catch (e) {
  // **消せなくても起動は止めない。** 開発が始められないほうが困る
  console.warn("⚠ .next を消せませんでした(起動は続けます)", e);
  console.warn("  手動で消すには: pnpm dev:clean <app>");
}
