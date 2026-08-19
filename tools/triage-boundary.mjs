#!/usr/bin/env node
/**
 * apps 側の型エラーが「アプリ側で直せる問題」か「基盤(packages/)側の
 * 修正が必要な問題」かを判定する。
 *
 * 【なぜ要るか】
 *
 * `pnpm --filter <app> typecheck` が失敗したとき、apps 側の開発者は
 * 「自分のコードが間違っているのか、基盤の型が足りないのか」が
 * すぐには分からない。エラーメッセージだけでは判断できない
 * ——このセッションで見つけた `as unknown as` の型不整合(sameSite の
 * 表記・AuthSessionOptions.salt の欠落・BulkItemResult の重複定義)は
 * すべて packages/ 側が原因だったが、apps 側の呼び出しコードで
 * エラーが出るため、区別する仕組みが無ければ気づきにくい。
 *
 * 【何をするか】
 *
 * `tsc` のエラー出力を読み、各エラー行のファイルパスが
 * `apps/` か `packages/` かで一次分類する。**さらに一歩踏み込み**、
 * エラーメッセージに出てくる型名・インターフェース名を
 * `packages/*\/src` 全体から `grep` して、**その型がどこで宣言されて
 * いるか**を添える——エラーの発生行が apps/ 側でも、原因の型定義が
 * packages/ 側にあるなら「基盤側の確認が要るかもしれない」と分かる。
 *
 * 【使い方】
 *
 *   node tools/triage-boundary.mjs <tscの出力を書いたファイル>
 *   # または、パイプで渡す:
 *   tsc --noEmit 2>&1 | node tools/triage-boundary.mjs
 *
 * **完全な自動判定はできない。** 型名が packages/ 側にあるからといって
 * 必ずしも「基盤のバグ」とは限らない(呼び出し側の使い方が誤っている
 * だけのこともある)。これは**判断材料を提示するツール**であって、
 * 最終判断は人が行うこと。
 *
 * @packageDocumentation
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// **`.pathname` を使わない。** Windows では `/C:/Users/...` になり、
// パスとして扱うと `C:\C:\Users\...` と二重になる(Linux では偶然通る)。
const root = fileURLToPath(new URL("..", import.meta.url));

/** tsc の1行分のエラーを解析する。 */
function parseLine(line) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  if (!m) return null;
  const [, file, lineNo, col, code, message] = m;
  return { file, lineNo: Number(lineNo), col: Number(col), code, message };
}

/**
 * メッセージから型名らしき識別子を抜き出す。
 *
 * **完全ではない。** `'型名'` という引用符付きの表記を拾う簡易な方法
 * ——TS のエラーメッセージは型名を単引用符で囲むことが多い
 * (`Property 'X' does not exist on type 'Y'` 等)ので、それを利用する。
 */
function extractTypeNames(message) {
  const names = new Set();
  for (const m of message.matchAll(/'([A-Z][A-Za-z0-9_]*)'/g)) {
    names.add(m[1]);
  }
  return [...names];
}

/** 型名が packages/*\/src のどこかで宣言されているか探す(export interface/type/function/class)。 */
function findDeclaration(name) {
  try {
    const pattern = `export (interface|type|function|class|const) ${name}\\b`;
    const out = execSync(
      `grep -rEl ${JSON.stringify(pattern)} ${JSON.stringify(root + "packages")} --include=*.ts 2>/dev/null | grep -v '\\.test\\.ts$'`,
      { encoding: "utf8" },
    ).trim();
    if (!out) return null;
    const files = out.split("\n").filter(Boolean);
    return files.map((f) => f.replace(root, ""));
  } catch {
    return null;
  }
}

function classify(file) {
  const rel = file.replace(root, "");
  if (rel.startsWith("packages/")) return "foundation";
  if (rel.startsWith("apps/")) return "app";
  return "other";
}

function main() {
  const arg = process.argv[2];
  const input = arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");
  const lines = input.split("\n");
  const errors = lines.map(parseLine).filter(Boolean);

  if (errors.length === 0) {
    console.log("エラーが見つかりませんでした(tsc の出力を正しく渡していますか?)");
    return;
  }

  const appErrors = [];
  const foundationErrors = [];
  const appErrorsWithFoundationType = [];

  for (const e of errors) {
    const origin = classify(e.file);
    if (origin === "foundation") {
      foundationErrors.push(e);
      continue;
    }
    if (origin !== "app") continue;

    const typeNames = extractTypeNames(e.message);
    let foundationHit = null;
    for (const name of typeNames) {
      const decls = findDeclaration(name);
      if (decls && decls.length > 0) {
        foundationHit = { name, decls };
        break;
      }
    }
    if (foundationHit) {
      appErrorsWithFoundationType.push({ ...e, foundationHit });
    } else {
      appErrors.push(e);
    }
  }

  console.log(`\n合計 ${errors.length} 件のエラーを分類しました。\n`);

  if (foundationErrors.length > 0) {
    console.log(`━━━ 基盤(packages/)側で発生: ${foundationErrors.length} 件 ━━━`);
    console.log("→ このエラーは packages/ 内のファイルで起きています。基盤側の修正が必要です。\n");
    for (const e of foundationErrors) {
      console.log(`  ${e.file}:${e.lineNo} [${e.code}] ${e.message}`);
    }
    console.log();
  }

  if (appErrorsWithFoundationType.length > 0) {
    console.log(`━━━ apps/ 側で発生・原因は基盤の型かもしれない: ${appErrorsWithFoundationType.length} 件 ━━━`);
    console.log("→ エラー自体は apps/ 側だが、関係する型が packages/ で宣言されています。");
    console.log("  packages/ の型定義が実態と合っているか確認してください(必ずしも基盤の");
    console.log("  バグとは限らず、呼び出し方が誤っているだけの場合もあります)。\n");
    for (const e of appErrorsWithFoundationType) {
      console.log(`  ${e.file}:${e.lineNo} [${e.code}] ${e.message}`);
      console.log(`    → 型 '${e.foundationHit.name}' の宣言元:`);
      for (const d of e.foundationHit.decls) console.log(`       ${d}`);
    }
    console.log();
  }

  if (appErrors.length > 0) {
    console.log(`━━━ apps/ 側の問題(基盤の型は絡んでいない): ${appErrors.length} 件 ━━━`);
    console.log("→ アプリ側のコードで直してください。\n");
    for (const e of appErrors) {
      console.log(`  ${e.file}:${e.lineNo} [${e.code}] ${e.message}`);
    }
    console.log();
  }

  console.log("─────────────");
  console.log("このツールは判断材料を提示するだけです。「型が packages/ にある」からと");
  console.log("いって必ず基盤のバグとは限りません——最終判断は人が行ってください。");
}

main();
