#!/usr/bin/env node
/**
 * **条件だけあって、中身が無い分岐**を見つける。
 *
 * 【何が起きるか】
 *
 * ```ts
 * if (featureEnv.SENTRY_DSN) {
 *   // const Sentry = await import("@sentry/nextjs");
 *   // Sentry.init({ dsn: featureEnv.SENTRY_DSN });
 * }
 * ```
 *
 * **設定すれば動くように見える。** `.env.example` に `SENTRY_DSN=` があり、
 * 環境変数も宣言され、分岐もある。**動かないのは中身だけ**。
 *
 * 2026-08、`instrumentation.ts` が実際にこの形だった。
 * 一方 `docs/ops/INCIDENT_RESPONSE.md` は「エラー追跡は Sentry で見る」と
 * 書いていた——**手順書だけが存在する**状態で、
 * 障害の最中に「見えない」と気づくことになる。
 *
 * ADR 0024(**作ったが繋いでいない**)の、最も分かりにくい形。
 * 消し忘れではなく「後で有効化するつもり」で置かれるので、
 * **書いた本人の記憶からも消える**。
 *
 * 【判定】
 * `if (…) {` の本体が**コメントと空行だけ**なら違反。
 *
 * `else` が無く、`return` も無く、ただ何もしない分岐は、
 * **書いてある条件が嘘**になる。
 *
 * 【意図して空にしたいとき】
 * 直前の行に `// 意図的に何もしない: 理由` と書く。
 * **理由を書かせる**のが目的で、禁止したいわけではない。
 *
 * 実行: node tools/check-empty-branches.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。 */
const DIRS = ["apps", "packages"];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "generated", ".git"]);

/** 除外の宣言。 */
const INTENTIONAL = /意図的に何もしない|intentionally empty/;

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));
const offenders = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  // **テンプレート文字列の中は見ない。** 画面に**コード例を表示する**ために
  // `if (…) { // 新 UI }` と書いてあるだけ、という箇所がある(showcase)。
  // 例として正しい書き方なので、赤にすると**説明が書けなくなる**。
  // 中身は消さず改行だけ残して、行番号がずれないようにする。
  const lines = raw
    .replace(/`(?:\\.|[^`\\])*`/gs, (m) => "`" + "\n".repeat((m.match(/\n/g) ?? []).length) + "`")
    .split("\n");

  for (const [i, line] of lines.entries()) {
    // `if (…) {` で始まり、その行で閉じていないもの
    if (!/^\s*(\}\s*else\s+)?if\s*\(/.test(line)) continue;
    if (!/\{\s*$/.test(line)) continue;

    const indent = (line.match(/^\s*/) ?? [""])[0].length;
    // 直前の行に意図の宣言があれば見逃す
    if (INTENTIONAL.test(lines[i - 1] ?? "")) continue;

    // 本体を読む(同じ字下げの `}` まで)
    let hasStatement = false;
    let closed = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const body = lines[j] ?? "";
      const bodyIndent = (body.match(/^\s*/) ?? [""])[0].length;
      if (/^\s*\}/.test(body) && bodyIndent <= indent) { closed = true; break; }
      if (body.trim() === "") continue;
      // コメント行は「中身」に数えない
      if (/^\s*(\/\/|\/\*|\*)/.test(body)) continue;
      hasStatement = true;
      break;
    }
    if (closed && !hasStatement) {
      offenders.push({ where: `${rel}:${i + 1}`, code: line.trim().slice(0, 60) });
    }
  }
}

if (offenders.length === 0) {
  console.log(`✅ 中身の無い条件分岐はありません(${files.length} ファイルを検査)`);
  process.exit(0);
}

console.error(`❌ 条件だけあって中身が無い分岐が ${offenders.length} 件あります(${files.length} ファイルを検査):`);
for (const o of offenders) console.error(`   ${o.where}: ${o.code}`);
console.error("");
console.error("   **設定すれば動くように見えて、動きません。**");
console.error("   `.env.example` に鍵があり、環境変数も宣言され、分岐もある——中身だけが無い状態です。");
console.error("   手順書が「これで見られる」と書いていると、**障害の最中に見えないと気づきます**。");
console.error("");
console.error("   実装するか、消すか、意図して空なら**直前の行に理由**を書いてください:");
console.error("     // 意図的に何もしない: <理由>");
process.exit(1);
