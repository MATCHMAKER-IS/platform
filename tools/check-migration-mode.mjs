#!/usr/bin/env node
/**
 * **スキーマの適用方式が固定されていないか**を見る。
 *
 * 【何を守るか】
 * このリポジトリは **開発中は `db push`、本番運用を始めたらマイグレーション**
 * という段取りになっている(ADR 0013 → 0014)。切り替えは `pnpm db baseline`。
 *
 * 問題は、`db push` を叩く場所が**散らばること**だった。2026-08 時点で 4 か所:
 *
 * - `apps/internal-app/Dockerfile.migrate`(**本番のデプロイ経路**)
 * - `scripts/setup.sh`
 * - `.github/workflows/ci.yml`
 * - `.github/workflows/e2e.yml`
 *
 * 切り替えの日にこの 4 つを全部直さないと、**本番だけ `db push` のまま**残る。
 * ADR 0014 が「本番で `db push` を実行しない」と明記している、まさにその状態:
 * **列の削除が無警告で走り、気づくのはデータが消えた後**。
 *
 * 逆向きの事故も既に起きている——**履歴が 1 つも無いのに `migrate deploy` 固定**で、
 * 何も適用されず E2E がテーブル不在で落ちた(ADR 0013 の背景)。
 *
 * **どちらの向きにも倒れる。** だから方式は `tools/apply-schema.mjs` が
 * `prisma/migrations/` の有無を見て決める。ここは、その入口を**迂回していないか**を見る。
 *
 * 【見るもの】
 * 1. スキーマを適用する箇所が `prisma db push` / `prisma migrate deploy` を**直接**呼んでいないか
 * 2. `migrations/` があるのに空(`migration.sql` が 1 つも無い)になっていないか
 *    ——`migrate deploy` が「適用するものが無い」で**通ってしまう**
 *
 * 実行: node tools/check-migration-mode.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 見る対象。**スキーマを DB へ当てる可能性のある場所**だけ。
 */
const TARGETS = [
  ".github/workflows/ci.yml",
  ".github/workflows/e2e.yml",
  ".github/workflows/contract.yml",
  ".github/workflows/deploy-conoha.yml",
  ".github/workflows/release.yml",
  "scripts/setup.sh",
  "scripts/setup.ps1",
  "scripts/setup.bat",
  "docker-compose.yml",
  "docker-compose.prod.yml",
  "docker-compose.staging.yml",
  "apps/internal-app/Dockerfile.migrate",
  "apps/crud-template/Dockerfile.migrate",
  "apps/line-console/Dockerfile.migrate",
];

/**
 * 直接呼び出しの形。**コメントは対象外**(説明で書くのは正しい)。
 */
const DIRECT = [
  { re: /prisma\s+db\s+push/, what: "prisma db push" },
  { re: /prisma\s+migrate\s+deploy/, what: "prisma migrate deploy" },
];

/** 迂回してよいもの。**理由を必ず添える。** */
const ALLOW = [
  {
    file: "tools/apply-schema.mjs",
    why: "この入口自身。ここが両方を呼び分ける",
  },
];

const problems = [];
let scanned = 0;

for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) continue;
  scanned += 1;
  if (ALLOW.some((a) => a.file === rel)) continue;
  const lines = readFileSync(full, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    // コメント行は見ない(「なぜそうするか」の説明で出てくる)
    if (/^\s*#/.test(line)) continue;
    for (const d of DIRECT) {
      if (!d.re.test(line)) continue;
      problems.push({
        kind: "direct",
        where: `${rel}:${i + 1}`,
        what: d.what,
      });
    }
  }
}

// 空の migrations/(migrate deploy が黙って通る)
const appsDir = path.join(ROOT, "apps");
let appsChecked = 0;
if (existsSync(appsDir)) {
  for (const e of readdirSync(appsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(appsDir, e.name, "prisma", "migrations");
    if (!existsSync(dir)) continue;
    appsChecked += 1;
    const hasSql = readdirSync(dir, { withFileTypes: true }).some(
      (d) => d.isDirectory() && existsSync(path.join(dir, d.name, "migration.sql")),
    );
    if (!hasSql) {
      problems.push({
        kind: "empty",
        where: `apps/${e.name}/prisma/migrations`,
        what: "中身が空",
      });
    }
  }
}

if (problems.length === 0) {
  console.log(
    `✅ スキーマの適用方式は自動判定に任せています(${scanned} か所 / migrations を持つアプリ ${appsChecked} 件)`,
  );
  process.exit(0);
}

console.error(`❌ スキーマの適用方式が固定されています(${problems.length} 件 / ${scanned} か所を検査):`);
for (const p of problems) {
  if (p.kind === "direct") {
    console.error(`   ${p.where}: \`${p.what}\` を直接呼んでいます`);
  } else {
    console.error(`   ${p.where}: ${p.what}(migrate deploy が「適用するものが無い」で通ってしまいます)`);
  }
}
console.error("");
console.error("   **`node tools/apply-schema.mjs <アプリ名>` を使ってください。**");
console.error("   `prisma/migrations/` の有無を見て、db push と migrate deploy を選びます:");
console.error("     履歴なし → prisma db push（開発中。ADR 0013）");
console.error("     履歴あり → prisma migrate deploy（本番で安全な唯一の方法。ADR 0014）");
console.error("");
console.error("   固定すると、切り替えの日に**直し忘れた場所だけが古い方式のまま**残ります。");
process.exit(1);
