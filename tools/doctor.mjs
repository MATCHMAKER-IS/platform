/**
 * 開発環境の健康診断。何が足りないかを一覧で示す（setup 前の確認や、動かないときの切り分けに）。
 *   node tools/doctor.mjs
 *
 * 破壊的な操作はしない。読み取りのみで、Node/pnpm のバージョン、必須ツール、.env の有無、
 * ワークスペース構成、生成物の drift をチェックする。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

let warn = 0;
let ng = 0;
const okLine = (m) => console.log(`  ✅ ${m}`);
const warnLine = (m) => { console.log(`  ⚠️  ${m}`); warn += 1; };
const ngLine = (m) => { console.log(`  ❌ ${m}`); ng += 1; };

function cmd(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
function has(bin) {
  return cmd(process.platform === "win32" ? "where" : "which", [bin]).ok;
}

console.log("🩺 開発環境の診断\n");

// Node
console.log("[ランタイム]");
const node = cmd("node", ["-v"]);
if (node.ok) {
  const major = Number(node.out.replace(/^v/, "").split(".")[0]);
  if (major >= 22) okLine(`Node.js ${node.out}`);
  else ngLine(`Node.js ${node.out}（22 以上が必要）`);
} else {
  ngLine("Node.js が見つかりません");
}

if (has("pnpm")) okLine(`pnpm ${cmd("pnpm", ["-v"]).out}`);
else if (has("corepack")) warnLine("pnpm 未有効（corepack enable で有効化できます）");
else warnLine("pnpm / corepack が見つかりません");

// 任意ツール
console.log("\n[任意ツール]");
for (const [bin, note] of [["docker", "ローカル DB / メール（-SkipDocker で省略可）"], ["git", "バージョン管理"]]) {
  if (has(bin)) okLine(`${bin}`);
  else warnLine(`${bin} が見つかりません（${note}）`);
}

// ワークスペース
console.log("\n[ワークスペース]");
const pkgCount = readdirSync(path.join(ROOT, "packages")).filter((d) => existsSync(path.join(ROOT, "packages", d, "package.json"))).length;
const appCount = readdirSync(path.join(ROOT, "apps")).filter((d) => existsSync(path.join(ROOT, "apps", d, "package.json"))).length;
okLine(`packages: ${pkgCount} / apps: ${appCount}`);
if (existsSync(path.join(ROOT, "node_modules"))) okLine("node_modules あり（install 済み）");
else warnLine("node_modules なし（pnpm install を実行してください）");

// .env
console.log("\n[.env]");
const appsDir = path.join(ROOT, "apps");
for (const app of readdirSync(appsDir).filter((d) => existsSync(path.join(appsDir, d, "package.json")))) {
  const hasExample = existsSync(path.join(appsDir, app, ".env.example"));
  const hasEnv = existsSync(path.join(appsDir, app, ".env"));
  if (!hasExample) continue;
  if (hasEnv) okLine(`${app}/.env あり`);
  else warnLine(`${app}/.env なし（cp apps/${app}/.env.example apps/${app}/.env）`);
}

// Prisma クライアント（アプリごとに生成先を分けている）
// **`import type` だと実行時に消えるため、無くても型検査は通る。**
// 2026-08、`createDb` が実体を受け取る形に変えた途端に
// 「Can't resolve '../generated/prisma'」で起動しなくなった。
// 生成物は git 管理外なので、**環境を作り直すたびに必要**。
console.log("\n[Prisma クライアント]");
{
  const appsDir = path.join(ROOT, "apps");
  let apps = [];
  try { apps = readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { apps = []; }
  let checked = 0;
  for (const app of apps) {
    // schema.prisma を持つアプリだけが対象
    if (!existsSync(path.join(appsDir, app, "prisma", "schema.prisma"))) continue;
    checked += 1;
    const generated = path.join(appsDir, app, "src", "generated", "prisma");
    if (existsSync(generated)) okLine(`${app}: 生成済み`);
    else ngLine(`${app}: 未生成 — \`pnpm db generate all\` を実行してください（src/generated/prisma が無いと起動しません）`);
  }
  if (checked === 0) warnLine("schema.prisma を持つアプリが見つかりません");
}

// 生成物 drift（速い・依存不要）
console.log("\n[生成物]");
const cg = spawnSync("node", [path.join(ROOT, "tools", "check-generated.mjs")], { encoding: "utf8" });
if (cg.status === 0) okLine("生成物は最新（drift なし）");
else warnLine("生成物に drift の可能性（pnpm gen:all で再生成）");

// まとめ
// ---- ビルドの古さ ----
// **Next は基盤パッケージを取り込んでビルドする。**
// その結果は `.next` に残り、パッケージ側を直しても作り直されないことがある
// (2026-08、`packages/ui` の古い AppSkin が出続けた)。
// 症状は「直したのに反映されない」「Hydration failed」で、原因が読み取れない
console.log("\n[ビルドの新しさ]");
{
  /** ディレクトリ内で最も新しい更新時刻。 */
  const newest = (dir, depth = 0) => {
    if (depth > 4) return 0;
    let max = 0;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) {
      if (["node_modules", ".next", "dist", "generated"].includes(e.name)) continue;
      const p2 = path.join(dir, e.name);
      if (e.isDirectory()) max = Math.max(max, newest(p2, depth + 1));
      else if (/\.(ts|tsx|css)$/.test(e.name)) {
        try { max = Math.max(max, statSync(p2).mtimeMs); } catch { /* noop */ }
      }
    }
    return max;
  };

  const pkgTime = newest(path.join(ROOT, "packages"));
  let stale = [];
  for (const group of ["apps"]) {
    const base = path.join(ROOT, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const nextDir = path.join(base, name, ".next");
      if (!existsSync(nextDir)) continue;
      let built = 0;
      try { built = statSync(nextDir).mtimeMs; } catch { continue; }
      if (built < pkgTime) stale.push(`${group}/${name}`);
    }
  }
  if (stale.length === 0) {
    console.log("✅ ビルドは基盤パッケージより新しい(または未ビルド)");
  } else {
    warn += 1;
    console.log(`⚠ 基盤を直した後のビルドが残っています: ${stale.join(", ")}`);
    console.log("   直したのに反映されないときは: pnpm dev:clean <app>");
  }
}

// **引き継ぎ時に書き換えるものを知らせる。**
// `onboarding/README.md` にも書いてあるが、**忘れる**——
// `doctor` は環境が動かないときに必ず叩くので、**ここに出しておけば目に入る**。
//
// **落としません。** サンプル値は開発中なら正しく、
// **CI で止めると引き継ぎ前の作業が進まない**。
console.log("\n[引き継ぎ時に書き換えるもの]");
try {
  const { execSync } = await import("node:child_process");
  const out = execSync("node tools/check-placeholders.mjs", {
    cwd: ROOT,
    encoding: "utf8",
  });
  const lines2 = out.trim().split("\n").filter((l) => l.trim() !== "");
  // **1 行目(件数)と、ファイル名の行だけ**出す。説明は長いので省く
  for (const l of lines2.slice(0, 8)) console.log(l);
} catch {
  console.log("⚠️  確認できませんでした（node tools/check-placeholders.mjs を直接実行してください）");
}

console.log("\n─────────────");
if (ng > 0) {
  console.log(`❌ 要対応 ${ng} 件、警告 ${warn} 件。上の ❌ を解消してください。`);
  process.exit(1);
} else if (warn > 0) {
  console.log(`✅ 必須項目は OK。警告 ${warn} 件（任意対応）。`);
} else {
  console.log("✅ すべて良好です。");
}

// export（テスト用に純粋関数化しづらいので、実行主体のツール）
export {};
