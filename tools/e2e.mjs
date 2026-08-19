#!/usr/bin/env node
/**
 * E2E を走らせる(前提を確かめてから)。
 *
 * 【なぜ playwright を直接呼ばないか】
 * Playwright の `globalSetup` は **`webServer` の起動より後**に走る。
 * つまり「DB が無い」「クライアントが未生成」でサーバが起動できない場合、
 * `globalSetup` に到達する前に**120 秒待たされてタイムアウトする**
 * (2026-08、実際にこれで詰まった。出るのは
 *  「Timed out waiting 120000ms from config.webServer」だけで原因が分からない)。
 *
 * ここで先に見て、足りないものを名指しで伝える。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ポートが開いているか。 */
function isOpen(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1500);
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
    sock.on("timeout", () => done(false));
  });
}

const problems = [];

// **DB が起動しているか。** internal-app はこれが無いと起動すらできない
if (!(await isOpen(5432))) problems.push("PostgreSQL が起動していません → pnpm db:up");

// **Prisma クライアントが生成されているか。**
// 無いと `Can't resolve '../generated/prisma'` で dev サーバが落ちる。
// **アプリ名を手書きしない**(増減のたびに追随が漏れる)。
// schema を持つアプリ = クライアントが要るアプリ
const missing = readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(path.join(ROOT, "apps", d.name, "prisma/schema.prisma")))
  .filter((d) => !existsSync(path.join(ROOT, "apps", d.name, "src/generated/prisma")))
  .map((d) => d.name);
if (missing.length > 0) {
  problems.push(`Prisma クライアントが未生成です(${missing.join(", ")}) → pnpm db generate all`);
}

// **`.env` があるか。**
// 無いと環境変数の検証で落ちて dev サーバが起動しない。
// 出るのは「DATABASE_URL: expected string, received undefined」で、
// **どのアプリの .env が無いのかは分からない**(2026-08 に詰まった)
const noEnv = readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(path.join(ROOT, "apps", d.name, ".env.example")))
  .filter((d) => !existsSync(path.join(ROOT, "apps", d.name, ".env")))
  .map((d) => d.name);
if (noEnv.length > 0) {
  problems.push(`.env がありません(${noEnv.join(", ")}) → .env.example をコピーしてください`);
}

if (problems.length > 0) {
  console.error("");
  console.error("❌ E2E の前提が揃っていません:");
  for (const p of problems) console.error(`   - ${p}`);
  console.error("");
  console.error("   揃えてから `pnpm e2e` をやり直してください。");
  console.error("   状態の確認は `pnpm doctor` が早いです。");
  console.error("");
  process.exit(1);
}

// **`shell: true` が要る。** Windows の pnpm は pnpm.cmd / pnpm.ps1
const r = spawnSync("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2)], {
  cwd: ROOT, stdio: "inherit", shell: true,
});
process.exit(r.status ?? 1);
