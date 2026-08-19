#!/usr/bin/env node
/**
 * **ソース中で「ここを見ろ」と書かれたパスが実在するかを確かめる。**
 *
 * 【なぜ要るか】
 * `check-docs-links` は `docs/` しか見ない。だが「実例は〜を参照」という案内は
 * **コード側のコメントやエラーメッセージにも書かれる**。そちらは誰も見張っていなかった。
 *
 * 2026-08 の実地課題(docs/onboarding/04-task.md)で、次の 2 件が見つかった:
 *
 *  - `apps/crud-template/src/server/authorize.ts` が、統合で消えた
 *    **`apps/equipment-app/src/server/guard.ts` を「実際に動く例」として案内**していた。
 *    しかも 1 つは**本番で投げる例外の本文**に入っており、
 *    「認証を実装してください(実例: 〜)」と言われて見に行くと存在しない。
 *    **雛形はコピーされる前提**なので、放置すると新しいアプリすべてに広がる。
 *  - `apps/showcase` のデモが `AppDemoNote source="apps/equipment-app"` で
 *    同じく消えたアプリを指していた。
 *
 * どちらも型検査・lint・smoke・preflight のすべてを通っていた。
 * **読み手が実際に探しに行くまで誰も気づかない**種類の誤りで、
 * 気づいたときには「この資料は当てにならない」という印象だけが残る。
 *
 * 【対象を apps/ と packages/ に絞る理由】
 * `tools/` の検査ツールは、**例示(`tools/xxx.mjs`)や過去の記述**
 * (「以前は demos 配下を指していた」)を持つのが仕事であって、誤りではない。
 * 対象に入れると誤検出だらけになり、**本物が埋もれる**。
 * この基盤では「誤検出だらけの検査は無いより悪い」を繰り返し踏んでいる。
 *
 * 実行: node tools/check-source-paths.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査しないディレクトリ。生成物は人が書いたものではない。 */
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".turbo", "dist", "coverage",
  "generated", // Prisma クライアント等(prisma generate を実行した環境だけが落ちるのを防ぐ)
]);

/**
 * 実在しなくて当然のもの。**理由を必ず添えること**
 * (「なんとなく除外」が残ると、検査が何を見ているか分からなくなる)。
 */
const ALLOW = [
  { re: /^tools\/(list|call)$/, why: "MCP のメソッド名。パスではない" },
  { re: /__verify__/, why: "verify-checks が検査の発火確認のため一時的に作るファイル" },
  { re: /\.env$/, why: ".env は git 管理外(手元には存在する)" },
  { re: /\bxxx\b|\bmy-app\b|\/x\/y$|\/x$|\/src$/, why: "手順や例示で使う仮の名前" },
];

/** 走査対象のソース。 */
function collect(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (/\.(ts|tsx|mjs|mts)$/.test(p)) acc.push(p);
  }
  return acc;
}

// **区切り文字の直後に来るものだけ**を拾う。
// 途中に現れる部分文字列(`https://…/apps/foo`)を誤って拾わないため。
const PATH_RE =
  /(?:^|[\s`'"(<])((?:apps|packages|demos|tools|scripts|e2e)\/[a-z0-9][\w.-]*(?:\/[\w.-]+)*)/g;

const files = [
  ...collect(path.join(ROOT, "apps")),
  ...collect(path.join(ROOT, "packages")),
];

const issues = [];
let checked = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  // **生成物は対象外。** 直しても次の生成で戻る
  if (rel.includes(".generated.")) continue;
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(PATH_RE)) {
      const p = m[1].replace(/[.,)、。]+$/, "");
      if (p.includes("*") || p.includes("$") || p.includes("<")) continue; // プレースホルダ
      const allowed = ALLOW.find((a) => a.re.test(p));
      if (allowed) continue;
      checked += 1;
      if (existsSync(path.join(ROOT, p))) continue;
      issues.push(`${rel}:${i + 1}: 参照先がありません → ${p}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ ソース中の参照先はすべて実在します(${checked} 件を検査 / ${files.length} ファイル)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**読み手が探しに行くまで誰も気づきません。**`);
console.error("消えたアプリ・移設したファイルを指していないか確認してください。");
console.error("例示として実在しないパスを書くなら、ALLOW に理由付きで登録すること。");
process.exit(1);
