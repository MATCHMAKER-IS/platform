#!/usr/bin/env node
/**
 * `pnpm install` の後に Prisma クライアントを生成する(postinstall)。
 *
 * 【なぜ要るか】
 * `src/generated/` は git 管理外なので、**clone や install のたびに消える**。
 * 気づかずに起動すると「Can't resolve '../generated/prisma'」で落ちるが、
 * エラーだけ見ても「generate を忘れた」とは分からない(2026-08 に何度か詰まった)。
 *
 * 【失敗しても install を止めない】
 * postinstall で落とすと、**依存を入れること自体ができなくなる**。
 * 生成に必要なのは schema だけで DB は要らないが、それでも
 * ネットワークやプラットフォームの都合で失敗しうる。
 * その場合は案内だけ出して、終了コード 0 で抜ける。
 *
 * 【CI では飛ばせる】
 * `SKIP_POSTINSTALL_GENERATE=1` で無効化できる。
 * CI は明示的に `pnpm db generate all` を呼んでいるので重複する。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.env["SKIP_POSTINSTALL_GENERATE"] === "1") {
  console.log("postinstall: SKIP_POSTINSTALL_GENERATE=1 のため生成を飛ばします");
  process.exit(0);
}

// **schema を持つアプリが無ければ何もしない。**
// 一覧を手で書かない(アプリの増減に追随する)
const appsDir = path.join(ROOT, "apps");
const hasSchema = existsSync(appsDir)
  && readdirSync(appsDir, { withFileTypes: true })
    .some((d) => d.isDirectory() && existsSync(path.join(appsDir, d.name, "prisma/schema.prisma")));

if (!hasSchema) process.exit(0);

console.log("postinstall: Prisma クライアントを生成します(src/generated/ は git 管理外のため)");

// **`shell: true` が要る。** Windows の pnpm は pnpm.cmd / pnpm.ps1 で、
// shell を介さないと起動できない(status が null になる)
const r = spawnSync("pnpm", ["db", "generate", "all"], {
  cwd: ROOT, stdio: "inherit", shell: true,
});

if (r.status !== 0) {
  // **install は止めない。** ここで落とすと依存すら入れられなくなる
  console.warn("");
  console.warn("⚠ Prisma クライアントの生成に失敗しました(install は続行します)");
  console.warn("  起動する前に手動で実行してください: pnpm db generate all");
  console.warn("  原因の切り分けは `pnpm doctor` が早いです");
}
