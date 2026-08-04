#!/usr/bin/env node
/**
 * ビルド生成物と依存を消す(**OS を選ばない**)。
 *
 *   node tools/clean.mjs          … dist / .next / .turbo を消す
 *   node tools/clean.mjs --all    … 上に加えて node_modules も消す
 *
 * 【なぜ Node で書くか】
 * 以前は `pnpm -r exec rm -rf …` だった。**Windows の cmd に `rm` は無い**ので、
 * `pnpm clean` も、それを呼ぶ `pnpm fresh` も動かなかった。
 * 開発者は Windows・CI は Linux という構成なので、
 * **shell のコマンドを直に書くと Windows でだけ壊れる**。
 * Node の `fs.rm` はどちらでも同じように動く。
 *
 * 【消す前に確認しないのはなぜか】
 * ここで消すのは**すべて作り直せるもの**だけ。
 * ソースや `.env` には触らない(消えると困るものを含めない)。
 */
import { rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALL = process.argv.includes("--all");

/** 生成物。作り直せるものだけを並べる。 */
const BUILD_ARTIFACTS = ["dist", ".next", ".turbo"];
const TARGETS = ALL ? [...BUILD_ARTIFACTS, "node_modules"] : BUILD_ARTIFACTS;

/** ワークスペースのディレクトリ(packages/* と apps/* と demos/*)。 */
async function workspaceDirs() {
  const dirs = [ROOT];
  for (const group of ["packages", "apps", "demos", "tools"]) {
    let entries;
    try {
      entries = await readdir(path.join(ROOT, group), { withFileTypes: true });
    } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) dirs.push(path.join(ROOT, group, e.name));
    }
  }
  return dirs;
}

let removed = 0;
for (const dir of await workspaceDirs()) {
  for (const t of TARGETS) {
    const target = path.join(dir, t);
    try {
      // `force: true` は「無ければ何もしない」。毎回 existsSync を挟まなくて済む
      await rm(target, { recursive: true, force: true });
      removed += 1;
    } catch (e) {
      // **消せなくても止めない。** Windows ではエディタや dev サーバが
      // ファイルを掴んでいて消せないことがある。どれが残ったかだけ伝える
      console.warn(`  ! 消せませんでした: ${path.relative(ROOT, target)}(${e.code ?? e.message})`);
    }
  }
}

console.log(`✅ 掃除しました(${TARGETS.join(" / ")} を ${removed} 箇所)`);
if (ALL) console.log("   次に pnpm install が必要です。");
