/**
 * 全 .ts / .tsx / .mts を **本物のパーサ(TypeScript)にかけて構文エラーを検出**する。
 *   node tools/check-syntax.mjs
 *
 * 【なぜ必要か】
 * 2026-07、`next build` が 6 件の構文エラーで落ちた。にもかかわらず
 * **preflight の 30 項目超はすべてグリーンだった**。理由は単純で、
 * ソースを構文として解釈する検査が 1 つも無かったから:
 *   - check-jsx-tags     … タグの開閉「数」を数えるだけ(式の中身は見ない)
 *   - check-build-ready  … import 解決・use client・重複 export だけ
 *   - check-imports      … 取り込んだ名前が実在するかだけ
 *   - smoke              … ロジックを実行するが .tsx は読まない
 * つまり「オフライン検証は全部通ったのにビルドが落ちる」という、
 * **ゲートを信じられなくする種類の穴**が空いていた。ここを塞ぐ。
 *
 * 実際に取り逃していた例(いずれも `<select>` → `@platform/ui` の `Select` 移行時の壊れ):
 *   options={[ { label: "A", value: 1}      ← カンマ欠落
 *              {label: "B", value: 2 } ]}
 *   options={[ ...xs.map(...) }, ]}         ← 余分な閉じ波括弧
 *   snippet={`… target: `x:${id}` …`}       ← 内側の ` を未エスケープでリテラルが途中終了
 *
 * 【型検査ではない】
 * ここが見るのは **構文だけ**(型は `pnpm typecheck` の担当)。
 * 構文だけなら依存インストール不要・全ファイルで数秒なので、オフラインゲートに置ける。
 * 型検査は node_modules が要るので CI 側で走らせる、という役割分担。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// preflight は「依存インストール不要」が前提なので、typescript が無くても落とさない。
// ただし **黙って素通りさせない**(気づかれない skip は、検査が無いのと同じ)。
let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  console.log("⏭  check-syntax は skip しました(typescript 未インストール)。`pnpm install` 後に再実行してください");
  console.log("   ※ この検査だけは依存が要ります。CI では install 済みなので必ず走ります");
  process.exit(0);
}

/** 検査対象のディレクトリ。生成物・依存は含めない。 */
const DIRS = ["packages", "apps", "tools", "e2e", "tests"];

// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)。
// **この検査こそ Windows で動く必要がある**(構文エラーはどの OS でも起きる)。
const files = collectFiles(DIRS, ROOT, { extensions: [".ts", ".tsx", ".mts"] });

let ng = 0;
for (const rel of files) {
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  const sf = ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  // parseDiagnostics は「構文として読めたか」だけを持つ(型の診断は含まれない)
  for (const d of sf.parseDiagnostics ?? []) {
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
    console.error(`❌ ${rel}:${line + 1}:${character + 1}  ${msg}`);
    ng += 1;
  }
}

if (ng > 0) {
  console.error(`\n❌ 構文エラー ${ng} 件(${files.length} ファイル検査)。この状態では next build が必ず落ちます`);
  process.exitCode = 1;
} else {
  console.log(`✅ 構文エラーなし(${files.length} ファイルをパース)`);
}
