#!/usr/bin/env node
/**
 * ビルドキャッシュ(`.next`)を消してから dev サーバを起動する。
 *
 * 【なぜ要るか】
 * Turbopack は変更を検知して差分だけ作り直すが、**レイアウトや
 * `packages/` 側の変更は追いきれないことがある**。すると
 * サーバが古い HTML、クライアントが新しい HTML を出して
 * 「Hydration failed」になる(2026-08 に 2 回踏んだ)。
 *
 * 見た目を直したのに反映されない・差分が出る、というときはこれで起動する。
 *
 * 【毎回消さない理由】
 * `.next` を消すと初回の表示が数十秒遅くなる。
 * 普段は `pnpm dev:internal` で十分で、**おかしいときだけ**こちらを使う。
 *
 * 実行:
 *   pnpm dev:clean internal-app
 *   pnpm dev:clean               … アプリ名を省くと一覧を出す
 */
import { spawnSync } from "node:child_process";
import { rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** dev スクリプトを持つワークスペース(アプリ・デモ)を集める。 */
function devTargets() {
  const out = [];
  for (const group of ["apps"]) {
    const dir = path.join(ROOT, group);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgPath = path.join(dir, name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.scripts?.dev === undefined) continue;
      out.push({ name: pkg.name, dir: path.join(dir, name), script: pkg.scripts.dev });
    }
  }
  return out;
}

const targets = devTargets();
const wanted = process.argv[2];

if (wanted === undefined) {
  console.log("使い方: pnpm dev:clean <アプリ名>");
  console.log("");
  console.log("起動できるもの:");
  for (const t of targets) console.log(`  ${t.name.padEnd(18)} ${t.script}`);
  console.log("");
  console.log("`.next` を消してから起動します(数十秒遅くなります)。");
  console.log("普段は `pnpm dev:internal` などで十分です。");
  process.exit(0);
}

const target = targets.find((t) => t.name === wanted);
if (target === undefined) {
  console.error(`❌ ${wanted} が見つかりません`);
  console.error(`   起動できるもの: ${targets.map((t) => t.name).join(" / ")}`);
  process.exit(1);
}

// **`packages/` を直したら `.next` は必ず消す。**
// Next は基盤パッケージを取り込んでビルドするが、
// **その結果は `.next` に残り、パッケージ側を直しても作り直されない**ことがある
// (2026-08、`packages/ui` の古い AppSkin が出続けた)。
const next = path.join(target.dir, ".next");
if (existsSync(next)) {
  // **Node の fs で消す。** `rm -rf` は cmd.exe に無い
  rmSync(next, { recursive: true, force: true });
  console.log(`▶ ${path.relative(ROOT, next)} を削除しました`);
} else {
  console.log("▶ .next はありません(そのまま起動します)");
}

// **ブラウザ側のキャッシュは消せない。**
// `.next` を消しても、Service Worker が保存した画面はブラウザに残る。
// 開発では登録しない作りにしたが、**過去に登録されたものは残る**ので案内する
console.log("");
console.log("  ※ 古い画面が出続けるときは、ブラウザ側にも残っています:");
console.log("     F12 → Application → Service Workers → Unregister");
console.log("     F12 → Application → Storage → Clear site data");
console.log("     (シークレットウィンドウで開くのが手早いです)");
console.log("");

// **`shell: true` が要る。** Windows の pnpm は pnpm.cmd / pnpm.ps1
const r = spawnSync("pnpm", ["--filter", target.name, "dev"], {
  cwd: ROOT, stdio: "inherit", shell: true,
});
process.exit(r.status ?? 1);
