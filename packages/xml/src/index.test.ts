import { describe, expect, it } from "vitest";
import { buildXml, parseXml, selectXml, findChildren, escapeXml, unescapeXml, textContent } from "./index";

describe("エスケープ", () => {
  // **忘れるとファイル全体が読めなくなる。** 取引先名に `&` は普通に入る
  it("5 文字すべてを変換する", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });
  // **`&` を最後に戻す**(先に戻すと二重デコードになる)
  it("往復して元に戻る", () => {
    const s = `A&B<商事>"x"'y'`;
    expect(unescapeXml(escapeXml(s))).toBe(s);
  });
  it("数値文字参照も戻す", () => {
    expect(unescapeXml("&#39;&#x27;")).toBe("''");
  });
});

describe("生成", () => {
  it("値を自動でエスケープする", () => {
    expect(buildXml({ name: "a", text: "A&B" })).toContain("A&amp;B");
  });
  it("属性もエスケープする", () => {
    expect(buildXml({ name: "a", attrs: { x: 'a"b' } })).toContain('x="a&quot;b"');
  });
  // **`undefined` の属性は出さない**(`attr="undefined"` を防ぐ)
  it("undefined の属性は出さない", () => {
    expect(buildXml({ name: "a", attrs: { x: undefined } })).not.toContain("x=");
  });
  it("中身が無ければ空要素", () => {
    expect(buildXml({ name: "a" }, { declaration: false })).toBe("<a/>");
  });
});

describe("解析", () => {
  it("属性とテキストを取れる", () => {
    const n = parseXml('<a><b x="1">値</b></a>');
    expect(n.children[0]?.attrs.x).toBe("1");
    expect(n.children[0]?.text).toBe("値");
  });
  // **官公庁の様式は日本語のタグを使う**(XML の仕様上も有効)
  it("日本語のタグ名を扱える", () => {
    const n = parseXml("<請求書><金額>1000</金額></請求書>");
    expect(selectXml(n, "金額")?.text).toBe("1000");
  });
  it("パスで深い要素を取れる", () => {
    const n = parseXml("<a><b><c>x</c></b></a>");
    expect(selectXml(n, "b/c")?.text).toBe("x");
    // **途中が欠ければ undefined**(例外にしない)
    expect(selectXml(n, "b/z/c")).toBeUndefined();
  });
  it("同名の子をすべて取れる", () => {
    expect(findChildren(parseXml("<a><b/><b/></a>"), "b")).toHaveLength(2);
  });
  // **子要素のテキストも拾う**(`node.text` は直下だけ)
  it("textContent は入れ子も繋げる", () => {
    expect(textContent(parseXml("<p>あ<b>い</b>う</p>"))).toBe("あいう");
  });
  // **黙って部分的な結果を返さない**(足りない項目に気づけなくなる)
  it("閉じタグが合わなければ例外", () => {
    expect(() => parseXml("<a><b></a>")).toThrow();
  });
  it("宣言とコメントを飛ばす", () => {
    const n = parseXml('<?xml version="1.0"?><!-- x --><a>v</a>');
    expect(n.name).toBe("a");
  });
});

describe("往復", () => {
  it("生成した XML を解析して同じ値が取れる", () => {
    const xml = buildXml({ name: "請求書", children: [{ name: "先", text: "A&B商事" }] });
    expect(selectXml(parseXml(xml), "先")?.text).toBe("A&B商事");
  });
});
