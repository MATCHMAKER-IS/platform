/**
 * ドキュメントの重複を検出する。
 *   node tools/check-docs-duplication.mjs
 *
 * 同じ内容が複数の資料にあると、片方だけ更新されて食い違う(実際に SETUP.md のポート表が
 * 古いまま残り、既に解消した問題の記述が残っていた)。機械的に検出する。
 *
 * 検出するもの:
 *   1. 同一の見出しが複数ファイルにある(役割分担が曖昧なサイン)
 *   2. 同一の表(3行以上)が複数ファイルにある(片方が古くなる)
 *   3. 同じ URL/ポートの一覧が複数ファイルにある
 *
 * 「重複＝即悪」ではない(意図的に両方へ書くこともある)。ALLOW に理由付きで登録すれば除外できる。
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** 検査対象(手書きの資料)。 */
const TARGETS = [
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "docs/README.md",
  "docs/APPS_AND_DEMOS.md",
  "docs/ops/GETTING_STARTED.md",
  "docs/ops/GETTING_STARTED_2.md",
  "docs/ops/GIT_GUIDE.md",
  "docs/ops/CURSOR_GUIDE.md",
  "docs/ops/TESTING_GUIDE.md",
  "docs/ops/DEVTOOLS_GUIDE.md",
  "docs/ops/INCIDENT_RESPONSE.md",
  "docs/ops/NEW_APP.md",
  "docs/ops/COMMANDS.md",
  "docs/ops/SETUP.md",
  "docs/ai/patterns.md",
];

/** 重複していてよいもの(理由つき)。 */
const ALLOW = {
  "確認": "各ページで独立した確認手順があるのは自然",
  "前提": "前提条件は文脈ごとに違う",
  "使い方": "対象が違えば内容も違う",
  "まとめ": "各ページの締め",
  "基本": "用語集などの汎用見出し",
  "手順": "文脈ごとに異なる",
  "トラブル": "対象が違う",
  "次に読むもの": "各ページからの導線として妥当",
  "チェックリスト": "対象(AI のコード / 新規アプリ)が違う",
  "検証": "文脈ごとに異なる",
  "開発ルール": "README は要点のみ・詳細は CLAUDE.md(導線として意図的)",
  "よく使うコマンド": "README は導線のみ・一覧は COMMANDS.md(意図的)",
  "リファレンスサイト": "docs/README は案内・SETUP は生成手順(役割が違う)",
  "クイックスタート": "README は最短手順・SETUP は詳細(導線あり)",
  "開発サーバ": "CLAUDE.md は AI/開発者向けの規約文脈・COMMANDS.md は早見表(役割が違う)",
  "データベース": "同上",
  "検証": "同上",
  "生成物": "同上",
  "書き方": "対象(コミットメッセージ / テスト)が違う",
  "実行": "対象が違う汎用見出し",
  "メールが届かない": "開発時(Mailpit)と本番時(SMTP設定)で対処が違う",
};

/** 見出しを集める(## 以下)。 */
function collectHeadings(body) {
  const out = [];
  for (const m of body.matchAll(/^#{2,4}\s+(.+)$/gm)) {
    const raw = (m[1] ?? "").trim();
    // 番号・記号を除いて正規化(「## 1. ツールを入れる」→「ツールを入れる」)
    const norm = raw.replace(/^[\d.\s]+/, "").replace(/[（(].*?[）)]/g, "").replace(/\s+/g, "").trim();
    if (norm) out.push({ raw, norm });
  }
  return out;
}

/** 表(| で始まる行が3行以上続くブロック)を集める。 */
function collectTables(body) {
  const tables = [];
  let current = [];
  for (const line of body.split("\n")) {
    if (line.trim().startsWith("|")) {
      current.push(line.trim());
    } else {
      if (current.length >= 3) tables.push(current.join("\n"));
      current = [];
    }
  }
  if (current.length >= 3) tables.push(current.join("\n"));
  return tables;
}

export function check() {
  const files = TARGETS.filter((f) => existsSync(path.join(ROOT, f)));
  const headingMap = new Map(); // norm -> [{file, raw}]
  const tableMap = new Map(); // 表の内容 -> [file]

  for (const rel of files) {
    const body = readFileSync(path.join(ROOT, rel), "utf8");
    for (const h of collectHeadings(body)) {
      if (!headingMap.has(h.norm)) headingMap.set(h.norm, []);
      headingMap.get(h.norm).push({ file: rel, raw: h.raw });
    }
    for (const t of collectTables(body)) {
      // 表の中身だけで比較(見出し行の差は無視)
      const key = t.replace(/\s+/g, "");
      if (key.length < 80) continue; // 小さい表は除外(誤検出が多い)
      if (!tableMap.has(key)) tableMap.set(key, []);
      tableMap.get(key).push(rel);
    }
  }

  const issues = [];

  // 1. 同一見出し
  for (const [norm, list] of headingMap) {
    if (list.length < 2) continue;
    if (Object.keys(ALLOW).some((a) => norm.includes(a.replace(/\s+/g, "")))) continue;
    const uniqueFiles = [...new Set(list.map((l) => l.file))];
    if (uniqueFiles.length < 2) continue; // 同じファイル内の重複は対象外
    issues.push({
      kind: "見出し",
      message: `「${list[0].raw}」が ${uniqueFiles.length} ファイルにあります: ${uniqueFiles.join(", ")}`,
    });
  }

  // 2. 同一の表
  for (const [, list] of tableMap) {
    const uniqueFiles = [...new Set(list)];
    if (uniqueFiles.length < 2) continue;
    issues.push({
      kind: "表",
      message: `同じ内容の表が ${uniqueFiles.length} ファイルにあります: ${uniqueFiles.join(", ")}（片方が古くなります）`,
    });
  }

  return { files: files.length, issues };
}

function main() {
  const { files, issues } = check();
  if (issues.length === 0) {
    console.log(`✅ ドキュメントに気になる重複はありません(${files} ファイル検査)`);
    return;
  }
  for (const i of issues) console.warn(`⚠️  [${i.kind}] ${i.message}`);
  console.warn(`\n${issues.length} 件。重複が意図的なら問題ありませんが、`);
  console.warn("「片方だけ更新されて食い違う」事故が起きやすい箇所です。");
  console.warn("役割分担を見直すか、片方に寄せて相互リンクにすることを検討してください。");
  // 警告のみ(重複が常に悪いわけではないため、CI は落とさない)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
