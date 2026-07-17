/**
 * 基盤(packages/)の変更をアプリ側へ安全に取り込むためのチェック。
 *   node tools/platform-sync.mjs           … 変更の確認(読み取りのみ)
 *   node tools/platform-sync.mjs --apply   … 生成物とスナップショットを更新
 *
 * このリポジトリはモノレポで、アプリは `workspace:*` でローカルの packages/ を直接参照する。
 * つまり**基盤を編集した瞬間からアプリはその新しいコードを使う**(npm install は不要)。
 * そのぶん、次の 2 つが起きやすい:
 *
 *   1. 破壊的変更に気づかない — export を消した/改名したのに、アプリ側が壊れたまま
 *   2. 生成物の更新漏れ — API 一覧・依存グラフ・ER 図が古いまま
 *
 * 「基盤をいじった後、アプリ開発に戻る前」に実行する想定。
 * 破壊的変更の検出そのものは tools/api-surface.mjs に任せ、ここは
 * 「その API を誰が使っているか(影響範囲)」を足して、判断できる形にする。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function runTool(args, { quiet = true } = {}) {
  const r = spawnSync("node", [path.join(ROOT, "tools", args[0]), ...args.slice(1)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
  });
  return { status: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * api-surface.mjs を呼んで破壊的変更を得る(検出ロジックは既存ツールに一本化)。
 * @returns { breaking: {pkg, names}[], addedCount, ok, raw }
 */
export function detectApiChanges() {
  const { status, out } = runTool(["api-surface.mjs"]);
  const breaking = [];
  for (const line of out.split("\n")) {
    // api-surface.mjs の出力: "❌ @platform/theme: export 削除 → ThemeSeed, deriveTheme"
    const m = line.match(/(@platform\/[a-z0-9-]+):\s*export\s*削除\s*→\s*(.+)$/);
    if (m && m[1] && m[2]) {
      breaking.push({ pkg: m[1], names: m[2].split(",").map((s) => s.trim()).filter(Boolean) });
    }
  }
  const addedMatch = out.match(/追加\s+(\d+)\s*件/);
  return { breaking, addedCount: addedMatch ? Number(addedMatch[1]) : 0, ok: status === 0, raw: out.trim() };
}

/**
 * その名前を apps/ demos/ が使っているか探す(破壊的変更の影響範囲)。
 * @platform を import しているファイルの中で名前が出現するかを見る(素朴だが実用十分)。
 */
export function findUsages(exportName) {
  const hits = [];
  const escaped = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`);
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
        walk(p);
      } else if (/\.(ts|tsx|mts)$/.test(e.name) && !e.name.includes(".test.")) {
        const body = readFileSync(p, "utf8");
        if (body.includes("@platform/") && re.test(body)) hits.push(path.relative(ROOT, p));
      }
    }
  };
  for (const area of ["apps", "demos"]) {
    const dir = path.join(ROOT, area);
    if (existsSync(dir)) walk(dir);
  }
  return hits;
}

/** 生成物が古くないか(check-generated を呼ぶだけ)。 */
export function generatedIsStale() {
  return runTool(["check-generated.mjs"]).status !== 0;
}

function main() {
  const apply = process.argv.includes("--apply");
  console.log("▶ 基盤の変更を確認します");
  console.log("  (モノレポなのでアプリは常にローカルの packages/ を直接使います。install は不要)\n");

  // 1. 公開 API の破壊的変更
  const { breaking, addedCount, ok } = detectApiChanges();
  if (addedCount > 0) console.log(`  追加された API: ${addedCount} 件(アプリへの影響なし)`);
  if (breaking.length === 0) {
    console.log("  削除/改名された API: なし");
  } else {
    console.log("\n⚠️  削除/改名された API があります(アプリが壊れる可能性)");
    for (const b of breaking) {
      for (const name of b.names) {
        const usages = findUsages(name);
        console.log(`  - ${b.pkg}: ${name}`);
        if (usages.length > 0) {
          console.log(`      使用箇所: ${usages.slice(0, 5).join(", ")}${usages.length > 5 ? ` ほか ${usages.length - 5} 件` : ""}`);
          console.log("      → 呼び出し側の修正が必要です");
        } else {
          console.log("      使用箇所: なし(安全に消せます)");
        }
      }
    }
  }

  // 2. 生成物の鮮度
  const stale = generatedIsStale();
  console.log(`\n  生成物(API一覧・依存グラフ・ER図): ${stale ? "⚠️ 古い可能性" : "最新"}`);

  if (!apply) {
    if (stale || !ok) console.log("\n`pnpm platform:sync` で生成物とスナップショットを更新できます。");
    return;
  }

  console.log("\n▶ 生成物を更新します…");
  if (runTool(["gen-all.mjs"], { quiet: false }).status !== 0) {
    console.error("❌ 生成物の更新に失敗しました");
    process.exit(1);
  }
  console.log("▶ API スナップショットを更新します…");
  runTool(["api-surface.mjs", "--update"]);
  console.log("\n✅ 同期しました。次は `pnpm typecheck` でアプリ側への影響を確認してください。");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
