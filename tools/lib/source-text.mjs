/**
 * **ソースを検査するときの共通処理。**
 *
 * 【なぜ共通化するか】
 * 検査を書くたびに同じ誤りを繰り返している。2026-08 の作業だけで **5 回**:
 *
 *  - `localeCompare\(([^)]*)\)` が入れ子括弧で切れ、**正しい行を誤検出**
 *  - `@example` のコメントを先に除去し、URL の `//` を巻き込んで**括弧が壊れた**
 *  - `await res.json()` と**変数名を決め打ち**して `paypal`(`r.json()`)を数え落とし
 *  - その誤りを `check-contract` の C007 に**そのまま埋め込んだ**
 *  - 依存の宣言漏れを測るとき、**TSDoc の例の import** を実物と誤認
 *
 * 対策は `docs/ops/HANDOVER.md` に書いてあるが、**測るたびに参照していない**。
 * 文書ではなく**関数として置けば、使うときに自然に正しくなる**。
 *
 * @packageDocumentation
 */

/**
 * コメントを除去する。**行番号と桁位置は保つ**。
 *
 * 指摘に行番号を出す検査が多いので、消すのではなく空白に置き換える。
 * 文字列リテラルの中の `//`(URL など)を巻き込まないよう、
 * **文字列を先に読み飛ばす**——これが 2 回目の誤りの原因だった。
 *
 * @param src ソース文字列
 * @returns コメントを空白にした同じ長さの文字列
 *
 * @example
 * ```js
 * stripComments('const u = "http://x"; // メモ');  // 'const u = "http://x";     '
 * ```
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    // 文字列は中身をそのまま残す(URL の // を守る)。
    //
    // **バッククォートは対にならないことがある。** TSDoc の中で
    // `` `word` `` のように 1 つだけ書かれると、そこから先を文字列として
    // 読み進めてしまい、**コメントの除去が止まる**
    // (`packages/csv` の `@example` がそれで残っていた)。
    // 開始位置から同じ行に閉じが無いバッククォートは、文字列とみなさない。
    if (ch === "`" && !src.slice(i + 1, src.indexOf("\n", i + 1) === -1 ? undefined : src.indexOf("\n", i + 1)).includes("`")) {
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < src.length) {
        out += src[i];
        if (src[i] === "\\") { i += 1; if (i < src.length) out += src[i]; i += 1; continue; }
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      // 改行だけ残して桁位置を保つ
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * `(` の位置から、対応する `)` までの中身を返す。
 *
 * **`[^)]*` で引数を取らない。** `localeCompare(String(bv), "ja")` のように
 * 入れ子があると最初の `)` で切れ、**正しく書けている行を誤検出する**
 * ——これが 1 回目の誤りだった。
 *
 * @param text 対象の文字列
 * @param openIndex `(` の位置
 * @returns 括弧の中身(対応が取れなければ末尾まで)
 *
 * @example
 * ```js
 * argsAt('a.f(g(1), "x")', 3);  // 'g(1), "x"'
 * ```
 */
export function argsAt(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return text.slice(openIndex + 1);
}

/**
 * メソッド呼び出しを探す正規表現を作る。
 *
 * **識別子を決め打ちしない。** `res` `response` `r` など呼び方は揃っておらず、
 * 決め打ちすると数え落とす——これが 3 回目・4 回目の誤りだった。
 *
 * @param method メソッド名(例 `"json"`)
 * @param options `awaited` を true にすると `await` 付きのみ。
 *   `exclude` に挙げた識別子(例 `["req","request"]`)は対象外
 * @returns 正規表現
 *
 * @example
 * ```js
 * methodCallRe("json", { awaited: true, exclude: ["req"] }).test("await r.json()");  // true
 * ```
 */
export function methodCallRe(method, options = {}) {
  const { awaited = false, exclude = [] } = options;
  const not = exclude.length > 0 ? `(?!${exclude.map((e) => `${e}\\b`).join("|")})` : "";
  return new RegExp(`${awaited ? "await\\s+" : ""}${not}\\w+\\.${method}\\(`);
}

/**
 * 宣言の直前にある TSDoc ブロックを返す。
 *
 * **開始と終了の記号を含む正規表現で一度に取らない。** 非貪欲でも、
 * 間に別の TSDoc(`@typedef` や 1 行説明)があると**そちらを掴む**。
 * 2026-08 に同じ誤りが 3 箇所で見つかり、`gen-reference` では
 * **API リファレンスの説明 1,208 件が別の宣言のもの**になっていた。
 *
 * export を先に見つけ、**直前のブロックを後ろから探す**のが正しい手順。
 * 間にコードが挟まっていれば、その TSDoc は別のものの説明とみなす。
 *
 * @param src ソース全体
 * @param declIndex 宣言(`export …`)の開始位置
 * @returns TSDoc の中身(開始と終了の記号を除いた部分)。無ければ空文字
 *
 * @example
 * ```js
 * const i = src.indexOf(DECL);   // DECL は探したい宣言の文字列
 * docBefore(src, i);            // "\n * その宣言の説明。\n "
 * ```
 */
export function docBefore(src, declIndex) {
  const before = src.slice(0, declIndex);
  const close = before.lastIndexOf("*/");
  if (close === -1) return "";
  // **間にコードがあれば別のものの説明。** 空白・改行だけなら直前とみなす
  if (before.slice(close + 2).trim() !== "") return "";
  const open = before.lastIndexOf("/**", close);
  return open === -1 ? "" : before.slice(open + 3, close);
}

/**
 * TSDoc の要約(最初の説明文)を返す。
 *
 * **`@` で始まる行・コード例・`@typedef` ブロックは要約にしない。**
 * `@keyframes` のように説明が `@` で始まると TSDoc のタグと区別できないので、
 * その場合は空を返す(説明の書き方を直すべき箇所として検出される)。
 *
 * @param doc {@link docBefore} が返した TSDoc の中身
 * @param maxLines 使う行数(既定 2)
 * @returns 要約。取れなければ空文字
 *
 * @example
 * ```js
 * summaryOf("\n * 何かをする。\n * @param a 引数\n ");  // "何かをする。"
 * ```
 */
export function summaryOf(doc, maxLines = 2) {
  // **行頭のタグだけを見る。** 説明文の中に「`@typedef` など」と
  // 書いてあるだけで型定義とみなすと、正しい説明まで捨てる
  // (この関数の説明自身がそれで空になった)
  if (/^\s*\*?\s*@typedef\b/m.test(doc)) return "";
  return doc
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l !== "" && !l.startsWith("@") && !l.startsWith("```"))
    .slice(0, maxLines)
    .join(" ");
}
