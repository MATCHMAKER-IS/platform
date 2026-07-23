/**
 * 社内資料の検索用インデックスを生成する。
 *
 * 出力: demos/showcase/public/docs-index.json
 *
 * なぜ静的ファイルにするか:
 *   - デモサイトは DB を持たず、単体で配信できることを前提にしている
 *   - JS バンドルへ埋めると初回表示が重くなるため、**アシスタント画面を開いたときだけ**取得する
 *   - 検索はブラウザ内で完結する(サーバも外部 API も要らない = 鍵が無くても動く)
 *
 * 本文は 1 節あたり上限まで切り詰める。全文を配ると 400KB を超え、
 * 「読むためのもの」ではなく「探すためのもの」という目的に対して過剰になるため。
 * 全文は元ファイルを開けば読める(結果にパスを載せている)。
 *
 * 実行: node tools/gen-docs-index.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocSections, isGenerated } from "./lib/doc-sections.mts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "demos/showcase/public/docs-index.json");

/**
 * 1 節あたりの本文の上限(文字)。検索と抜粋表示に足りる長さ。
 *
 * パッケージ README は数が多い(108 件)ため短めにする。
 * README は「どの部品を使うか」を判断できれば十分で、
 * 詳しい使い方は describe_package やファイル本体で読めばよい。
 */
const MAX_BODY = 700;
const MAX_BODY_README = 400;

/** ファイルごとの本文上限。 */
const limitOf = (file: string): number => (file.startsWith("packages/") ? MAX_BODY_README : MAX_BODY);

const sections = loadDocSections(ROOT);

const entries = sections
  // 自動生成物(API 一覧・依存グラフ等)は、人が読む「手順・判断」ではないため索引から外す
  .filter((s) => !isGenerated(s.file))
  // 見出しだけで中身が無い節も落とす
  .filter((s) => s.body.trim().length >= 40)
  .map((s) => ({
    f: s.file,
    h: s.heading,
    b: s.breadcrumb,
    t: s.body.length > limitOf(s.file) ? `${s.body.slice(0, limitOf(s.file))}…` : s.body,
    // 切り詰めたかどうか(画面で「全文は元ファイル」と案内するため)
    x: s.body.length > limitOf(s.file),
    p: s.pkg,
  }));

mkdirSync(path.dirname(OUT), { recursive: true });
const json = JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  count: entries.length,
  entries,
});
writeFileSync(OUT, `${json}\n`);

const kb = (json.length / 1024).toFixed(0);
console.log(`✅ 資料インデックスを生成しました: ${entries.length} 節 / ${kb} KB → demos/showcase/public/docs-index.json`);
