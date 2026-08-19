#!/usr/bin/env node
/**
 * 開発用のダミーデータを全アプリに投入する。
 *
 * **本番では動かない。** 各アプリの seed が `isProductionRuntime()` で止める
 * (ここでも一度見るが、**入口の判定だけに頼らない**。呼び方は増えるため)。
 *
 * 実行:
 *   pnpm seed              … seed を持つ全アプリ
 *   pnpm seed line-console … 1 つだけ
 */
import { spawnSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if ((process.env["NODE_ENV"] ?? "") === "production") {
  console.error("❌ 本番環境では実行できません(見本データが業務データに混ざります)");
  process.exit(1);
}

/** seed スクリプトを持つアプリを集める。**一覧を手で書かない**(足したら必ず漏れる)。 */
function appsWithSeed() {
  const out = [];
  for (const name of readdirSync(path.join(ROOT, "apps"))) {
    const pkgPath = path.join(ROOT, "apps", name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg.scripts?.seed !== undefined) out.push(name);
  }
  return out;
}

const only = process.argv[2];
const targets = only === undefined ? appsWithSeed() : [only];

if (targets.length === 0) {
  console.log("seed スクリプトを持つアプリがありません。");
  process.exit(0);
}

let failed = 0;
for (const app of targets) {
  console.log(`\n▶ ${app}`);
  // **Windows の pnpm は .cmd / .ps1。** shell を介さないと起動できない
  const r = spawnSync("pnpm", ["--filter", app, "seed"], {
    cwd: ROOT, stdio: "inherit", shell: true,
  });
  if (r.status !== 0) {
    console.error(`   ❌ ${app} の投入に失敗しました(${r.error?.message ?? `終了コード ${r.status}`})`);
    // **原因を決めつけない。** 以前は「DB が起動しているか、db push 済みか」とだけ
    // 案内していたが、実際の原因は **Prisma クライアントの未生成**だった。
    // 断定した案内は、当たっていないときに調査を遠回りさせる
    console.error("      原因の切り分けは `pnpm doctor` が早いです");
    console.error("      よくある原因: Prisma クライアント未生成(pnpm db generate all)");
    console.error("                    DB が未起動(pnpm db:up)/ スキーマ未適用(pnpm db push all)");
    failed += 1;
  }
}

console.log("\n─────────────");
if (failed > 0) {
  console.error(`❌ ${failed} / ${targets.length} 件が失敗しました。`);
  process.exit(1);
}
console.log(`✅ ${targets.length} アプリにダミーデータを投入しました。すべて架空のデータです。`);
