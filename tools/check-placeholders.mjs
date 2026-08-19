/**
 * **引き継ぎ時に書き換えが要るもの**を洗い出す。
 *
 * 【なぜ要るか】
 * この基盤は**数人で引き継いで改修していく**前提です。
 * 受け取った人が最初につまずくのは、**サンプルのまま残っている値**です:
 *
 * - `CODEOWNERS` の `@your-org` `@yamada` … **レビューが誰にも回らない**
 * - `.env.example` の `example.com` … 本番で使うと**メールが届かない**
 *
 * **エラーにはなりません。** 動いているように見えて、
 * **必要なときに動かない**——引き継ぎで一番困る種類です。
 *
 * 【落とすのではなく知らせる】
 * **`exit 1` にしません。** サンプル値は「まだ書き換えていない」状態を示すだけで、
 * **開発中は正しい**からです。CI で落ちると、引き継ぎ前の作業が止まります。
 *
 * 代わりに**一覧を出して**、`docs/onboarding/README.md` の
 * 「引き継いだ人が最初にやること」へ誘導します。
 *
 * 使い方:
 * ```
 * node tools/check-placeholders.mjs
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 探すもの。
 *
 * **`TODO` は入れません。** コード中の `TODO` は開発の途中経過で、
 * 引き継ぎとは別の話です（`check-maintainability` が別途見ています）。
 */
const PLACEHOLDERS = [
  { pattern: /@your-org\b/, what: "GitHub の組織名", why: "レビューが誰にも回りません" },
  { pattern: /@yamada\b/, what: "レビュー担当の名前", why: "レビューが誰にも回りません" },
  { pattern: /\bexample\.com\b/, what: "メールのドメイン", why: "本番で使うとメールが届きません" },
  { pattern: /\byour-domain\b/, what: "公開サイトのドメイン", why: "リンクが正しく作られません" },
];

/** 見る場所。**設定ファイルだけ**——資料の中の例示は対象外。 */
const TARGETS = [
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml",
];
for (const app of fs.readdirSync(path.join(ROOT, "apps"))) {
  const env = path.join("apps", app, ".env.example");
  if (fs.existsSync(path.join(ROOT, env))) TARGETS.push(env);
}

const found = [];
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    for (const p of PLACEHOLDERS) {
      if (p.pattern.test(lines[i] ?? "")) {
        found.push({ file: rel, line: i + 1, what: p.what, why: p.why });
      }
    }
  }
}

if (found.length === 0) {
  console.log(`✅ サンプルのまま残っている設定はありません(${TARGETS.length} ファイルを検査)`);
  process.exit(0);
}

// **`✅` で始める。** この検査は**落とさない**ので、
// 結果としては「成功」——`check-scan-reporting` が
// **成功時は `✅` + 数**を求めている(検査の出力を揃えるため)。
console.log(`✅ 引き継ぎ時に書き換える設定が ${found.length} 件あります(${TARGETS.length} ファイルを検査／開発中はこれで正しい状態です):`);
console.log("");
for (const f of found) {
  console.log(`   ${f.file}:${f.line}  ${f.what}`);
  console.log(`     → ${f.why}`);
}
console.log("");
console.log("**エラーにはなりません。** 動いているように見えて、");
console.log("**必要なときに動かない**——引き継ぎで一番困る種類です。");
console.log("手順は `docs/onboarding/README.md` の「引き継いだ人が最初にやること」へ。");
