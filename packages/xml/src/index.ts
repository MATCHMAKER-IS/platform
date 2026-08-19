/**
 * `@platform/xml` — XML の生成と解析(純関数・依存なし)。
 *
 * 【なぜ要るか】
 * 業務では**まだ XML が現役**——電子申告(e-Tax・eLTAX)、EDI、
 * 銀行の一部 API、SOAP、官公庁の様式。JSON に置き換わっていない。
 *
 * 【文字列連結で作る怖さ】
 * **エスケープを忘れると壊れる。** 取引先名に `&` が入るのは普通で
 * (「A&B商事」)、そのまま出すと**ファイル全体が読めなくなる**。
 * 受け取った側は「壊れています」としか言えず、原因の特定に時間がかかる。
 *
 * 【解析の方針】
 * **DOM を作らない軽量パーサ**。依存を増やさないため自前で持つ。
 * 名前空間・DTD・CDATA の一部・実体宣言には対応しない——
 * **複雑な XML を扱うなら専用ライブラリを使うこと**。
 * ここが想定するのは**素直な構造の設定ファイル・API 応答**。
 *
 * @packageDocumentation
 */

/**
 * XML の特殊文字を実体参照にする。
 *
 * **属性にも要素にも使える**ように 5 文字すべてを変換する
 * (`&` `<` `>` `"` `'`)——要素だけなら 3 文字で足りるが、
 * **使い分けを間違えるより過剰な方が安全**。
 *
 * **`&` を最初に変換する。** 後にすると、変換した実体参照の `&` を
 * さらに変換して `&amp;lt;` のように壊れる。
 *
 * @param value 変換する値(数値や `undefined` も受ける)
 * @returns エスケープ済みの文字列
 *
 * @example
 * ```ts
 * escapeXml("A&B商事");  // "A&amp;B商事"
 * escapeXml(undefined);  // ""
 * ```
 */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * 実体参照を元の文字に戻す。
 *
 * **`&amp;` を最後に戻す。** 先に戻すと、`&amp;lt;` が `&lt;` を経て
 * `<` になってしまう(**二重にデコードされる**)。
 *
 * 数値文字参照(`&#39;` `&#x27;`)にも対応する——
 * 送ってくる側の実装によって、どちらの形も来る。
 *
 * @param value 実体参照を含む文字列
 * @returns 元に戻した文字列
 */
export function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // **数値文字参照**(10 進・16 進)。`&#39;` は `'`
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    // **`&amp;` は最後**(先に戻すと二重デコードになる)
    .replace(/&amp;/g, "&");
}

/** XML の 1 要素。 */
export interface XmlNode {
  /** タグ名。 */
  name: string;
  /** 属性(**値はデコード済み**)。 */
  attrs: Record<string, string>;
  /** 子要素。 */
  children: XmlNode[];
  /** 直下のテキスト(**デコード済み**。子要素のテキストは含まない)。 */
  text: string;
  /**
   * 直下のテキストと子要素を、**出てきた順**に並べたもの。
   *
   * **`text` と `children` だけでは順序が失われる。** `<p>あ<b>い</b>う</p>` は
   * `text: "あう"` / `children: [b]` になり、繋ぎ直すと `"あうい"` になってしまう
   * (2026-08 に {@link textContent} で発覚)。順序が要るのはここだけなので、
   * **`text` / `children` は互換のためそのまま残し**、並び順をこちらに持つ。
   */
  parts: Array<string | XmlNode>;
}

/** {@link buildXml} に渡す要素の指定。 */
export interface XmlElement {
  /** タグ名。 */
  name: string;
  /** 属性(**値は自動でエスケープされる**)。 */
  attrs?: Record<string, string | number | boolean | undefined>;
  /** 子要素。 */
  children?: XmlElement[];
  /** テキスト(**自動でエスケープされる**。`children` と併用しない)。 */
  text?: string | number | undefined;
  /**
   * エスケープせずそのまま出す(**原則使わない**)。
   *
   * **`text` と違い、中身を検証しない。** 既に組み立てた XML の断片を
   * 差し込むときだけ使う——**利用者の入力を渡すと壊れる**。
   */
  raw?: string;
}

/** {@link buildXml} の設定。 */
export interface BuildXmlOptions {
  /** XML 宣言を付けるか(既定 true)。 */
  declaration?: boolean;
  /** 文字コード(既定 `"UTF-8"`)。 */
  encoding?: string;
  /**
   * 字下げする文字(既定は字下げなし)。
   *
   * **人が読む用。** 機械が読むだけなら不要で、
   * **ファイルサイズが増える**だけ。
   */
  indent?: string;
}

/** 1 要素を組み立てる(再帰)。 */
function buildElement(el: XmlElement, indent: string, depth: number): string {
  const pad = indent === "" ? "" : indent.repeat(depth);
  const nl = indent === "" ? "" : "\n";

  const attrs = Object.entries(el.attrs ?? {})
    // **`undefined` の属性は出さない**(`attr="undefined"` になるのを防ぐ)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");

  const kids = el.children ?? [];
  const hasText = el.text !== undefined && el.text !== "";
  const hasRaw = el.raw !== undefined && el.raw !== "";

  // **中身が無ければ空要素**(`<a/>`)。`<a></a>` より短く、意味は同じ
  if (kids.length === 0 && !hasText && !hasRaw) {
    return `${pad}<${el.name}${attrs}/>`;
  }

  // **テキストだけなら 1 行**(字下げしても読みやすくならない)
  if (kids.length === 0) {
    const inner = hasRaw ? (el.raw ?? "") : escapeXml(el.text);
    return `${pad}<${el.name}${attrs}>${inner}</${el.name}>`;
  }

  const inner = kids.map((c) => buildElement(c, indent, depth + 1)).join(nl);
  return `${pad}<${el.name}${attrs}>${nl}${inner}${nl}${pad}</${el.name}>`;
}

/**
 * XML を組み立てる。
 *
 * **値はすべて自動でエスケープされる**ので、取引先名に `&` が入っても壊れない。
 * エスケープしたくない場合だけ `raw` を使う(**原則使わない**)。
 *
 * @param root 最上位の要素
 * @param options 宣言・字下げの指定
 * @returns XML 文字列
 *
 * @example
 * ```ts
 * buildXml({
 *   name: "請求書",
 *   attrs: { 版: "1.0" },
 *   children: [
 *     { name: "取引先", text: "A&B商事" },   // 自動で A&amp;B商事 になる
 *     { name: "金額", text: 100000 },
 *   ],
 * }, { indent: "  " });
 * ```
 */
export function buildXml(root: XmlElement, options: BuildXmlOptions = {}): string {
  const indent = options.indent ?? "";
  const body = buildElement(root, indent, 0);
  if (options.declaration === false) return body;
  return `<?xml version="1.0" encoding="${escapeXml(options.encoding ?? "UTF-8")}"?>\n${body}`;
}

/**
 * XML を解析して要素の木にする。
 *
 * **軽量パーサ**。名前空間は**接頭辞を含んだ名前**として扱い
 * (`soap:Body` はそのまま `"soap:Body"`)、DTD・実体宣言は無視する。
 * **複雑な XML には専用ライブラリを使うこと**。
 *
 * **壊れた XML では例外を投げる。** 黙って部分的な結果を返すと、
 * **足りない項目に気づかないまま処理が進む**——受け取った申告データが
 * 途中で切れていても分からない。
 *
 * @param xml XML 文字列
 * @returns 最上位の要素
 * @throws `Error` — 閉じタグが合わない・要素が見つからない場合
 *
 * @example
 * ```ts
 * const node = parseXml('<a><b x="1">値</b></a>');
 * node.children[0].attrs.x;  // "1"
 * node.children[0].text;     // "値"
 * ```
 */
export function parseXml(xml: string): XmlNode {
  // **宣言・コメント・DTD を落とす。** 内容には関係しない
  const src = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  // タグまたはテキストを順に拾う
  // **タグ名に `\w` を使わない。** ASCII だけになり、
  // **日本語のタグ名が解析できない**——官公庁の様式は日本語のタグを使う
  // (`<請求書>` `<取引先名>`)。XML の仕様上も有効(2026-08)
  const re = /<\/?([^\s/>=]+)((?:\s+[^\s/>=]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;

  for (const m of src.matchAll(re)) {
    const [whole, name, attrStr, selfClose, textRaw] = m;

    if (name === undefined) {
      // テキスト。**空白だけなら捨てる**(字下げが text に入るのを防ぐ)
      const t = (textRaw ?? "").trim();
      if (t !== "" && stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top !== undefined) {
          const decoded = unescapeXml(t);
          top.text += decoded;
          // **順序も残す。** `text` に足すだけだと、子要素との前後が分からない
          top.parts.push(decoded);
        }
      }
      continue;
    }

    if (whole.startsWith("</")) {
      const closed = stack.pop();
      if (closed === undefined || closed.name !== name) {
        throw new Error(`XML の閉じタグが合いません: </${name}>`);
      }
      if (stack.length === 0) root = closed;
      continue;
    }

    const attrs: Record<string, string> = {};
    for (const a of (attrStr ?? "").matchAll(/([^\s/>=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const key = a[1];
      if (key !== undefined) attrs[key] = unescapeXml(a[2] ?? a[3] ?? "");
    }
    const node: XmlNode = { name, attrs, children: [], text: "", parts: [] };

    const parent = stack[stack.length - 1];
    if (parent !== undefined) {
      parent.children.push(node);
      parent.parts.push(node);
    }

    // **空要素は積まない**(`<a/>` はその場で閉じる)
    if (selfClose === "/") {
      if (stack.length === 0) root = node;
      continue;
    }
    stack.push(node);
  }

  if (stack.length > 0) {
    throw new Error(`XML の閉じタグが足りません: <${stack[stack.length - 1]?.name ?? ""}>`);
  }
  if (root === undefined) throw new Error("XML に要素がありません");
  return root;
}

/**
 * 名前で子要素を探す(**直下のみ**)。
 *
 * **見つからなければ `undefined`**。例外にしないのは、
 * 任意項目が欠けているだけの場合が多いため。
 *
 * @param node 親要素
 * @param name 探すタグ名
 * @returns 最初に見つかった子要素
 */
export function findChild(node: XmlNode, name: string): XmlNode | undefined {
  return node.children.find((c) => c.name === name);
}

/**
 * 名前で子要素をすべて探す(**直下のみ**)。
 *
 * @param node 親要素
 * @param name 探すタグ名
 * @returns 一致する子要素(**無ければ空配列**)
 */
export function findChildren(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((c) => c.name === name);
}

/**
 * パスで要素を取り出す(`"請求書/明細/金額"` のような形)。
 *
 * **深い階層から 1 つの値を取る**のに使う。
 * 途中が欠けていれば `undefined` を返す——
 * **`node.children[0].children[0]` と書くと、欠けたときに例外**になる。
 *
 * @param node 起点の要素
 * @param path `/` 区切りのタグ名
 * @returns 見つかった要素。**途中で欠ければ undefined**
 *
 * @example
 * ```ts
 * selectXml(root, "Body/Response/Status")?.text;
 * ```
 */
export function selectXml(node: XmlNode, path: string): XmlNode | undefined {
  let current: XmlNode | undefined = node;
  for (const part of path.split("/").filter((p) => p !== "")) {
    if (current === undefined) return undefined;
    current = findChild(current, part);
  }
  return current;
}

/**
 * 要素以下のテキストをすべて繋げて返す。
 *
 * **子要素のテキストも拾う。** `<p>あ<b>い</b>う</p>` なら `"あいう"`。
 * `node.text` は直下だけなので `"あう"` になる。
 *
 * @param node 対象の要素
 * @returns 繋げたテキスト
 */
export function textContent(node: XmlNode): string {
  // **`parts`(出てきた順)を辿る。** `text + children` の順で繋ぐと、
  // `<p>あ<b>い</b>う</p>` が `"あうい"` になる(直下のテキストを先に全部
  // 出してしまうため)。2026-08 に修正。
  return node.parts
    .map((p) => (typeof p === "string" ? p : textContent(p)))
    .join("");
}
