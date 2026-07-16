import { describe, it, expect } from "vitest";
import {
  truncate, truncateMiddle, truncateWords, truncateByWidth, textWidth, charLength,
  toHalfWidth, toFullWidth, toHalfWidthDigits, toFullWidthKana, normalizeText,
  normalizeSpace, normalizeNewlines, isBlank, splitLines,
  capitalize, capitalizeWords, camelCase, pascalCase, kebabCase, snakeCase, slugify,
  ensurePrefix, ensureSuffix, removePrefix, removeSuffix,
  stripHtml, escapeHtml, unescapeHtml, mask, maskEmail,
  padStartWidth, padEndWidth, wrapText, highlight, highlightTerms, parseTemplate, randomString, nanoid,
} from "./strings";

describe("truncate", () => {
  it("appends ellipsis", () => expect(truncate("abcdefg", 4)).toBe("abc…"));
  it("keeps short", () => expect(truncate("abc", 5)).toBe("abc"));
  it("surrogate-safe", () => expect(truncate("😀😁😂😃", 3)).toBe("😀😁…"));
  it("middle", () => expect(truncateMiddle("1234567890", 7)).toBe("123…890"));
  it("words", () => expect(truncateWords("the quick brown fox", 2)).toBe("the quick…"));
  it("by width", () => expect(truncateByWidth("あいうえお", 6)).toBe("あい…"));
});

describe("width", () => {
  it("fullwidth=2", () => expect(textWidth("あA1")).toBe(4));
  it("charLength surrogate", () => expect(charLength("😀a")).toBe(2));
});

describe("width conversion", () => {
  it("toHalfWidth", () => expect(toHalfWidth("Ａ１！　")).toBe("A1! "));
  it("toFullWidth", () => expect(toFullWidth("A1!")).toBe("Ａ１！"));
  it("digits only", () => expect(toHalfWidthDigits("Ａ１２")).toBe("Ａ12"));
  it("kana voiced", () => expect(toFullWidthKana("ｶﾞｷﾞ")).toBe("ガギ"));
  it("kana semi-voiced", () => expect(toFullWidthKana("ﾊﾟ")).toBe("パ"));
  it("normalizeText", () => expect(normalizeText("Ａ　Ｂ")).toBe("A B"));
});

describe("space/newline", () => {
  it("normalizeSpace", () => expect(normalizeSpace("  a　 b  ")).toBe("a b"));
  it("normalizeNewlines", () => expect(normalizeNewlines("a\r\nb\rc")).toBe("a\nb\nc"));
  it("isBlank", () => { expect(isBlank("　")).toBe(true); expect(isBlank("a")).toBe(false); });
  it("splitLines", () => expect(splitLines("a\r\nb")).toEqual(["a", "b"]));
});

describe("case", () => {
  it("capitalize", () => expect(capitalize("hello")).toBe("Hello"));
  it("capitalizeWords", () => expect(capitalizeWords("hello world")).toBe("Hello World"));
  it("camelCase", () => expect(camelCase("foo_bar-baz")).toBe("fooBarBaz"));
  it("pascalCase", () => expect(pascalCase("foo bar")).toBe("FooBar"));
  it("kebabCase", () => expect(kebabCase("fooBar Baz")).toBe("foo-bar-baz"));
  it("snakeCase", () => expect(snakeCase("fooBar")).toBe("foo_bar"));
  it("slugify", () => expect(slugify("Héllo World! 2026")).toBe("hello-world-2026"));
});

describe("prefix/suffix", () => {
  it("ensurePrefix", () => { expect(ensurePrefix("path", "/")).toBe("/path"); expect(ensurePrefix("/path", "/")).toBe("/path"); });
  it("ensureSuffix", () => expect(ensureSuffix("dir", "/")).toBe("dir/"));
  it("removePrefix", () => expect(removePrefix("/path", "/")).toBe("path"));
  it("removeSuffix", () => expect(removeSuffix("file.txt", ".txt")).toBe("file"));
});

describe("html", () => {
  it("stripHtml", () => expect(stripHtml("<b>hi</b>")).toBe("hi"));
  it("escapeHtml", () => expect(escapeHtml("<a>&")).toBe("&lt;a&gt;&amp;"));
  it("unescapeHtml", () => expect(unescapeHtml("&lt;a&gt;&amp;")).toBe("<a>&"));
});

describe("mask", () => {
  it("mask middle", () => expect(mask("1234567890", { keepStart: 2, keepEnd: 2 })).toBe("12******90"));
  it("mask short", () => expect(mask("ab", { keepStart: 2, keepEnd: 2 })).toBe("**"));
  it("maskEmail", () => expect(maskEmail("taro@example.com")).toBe("t***@example.com"));
});

describe("pad (width-aware)", () => {
  it("padStartWidth fullwidth", () => expect(padStartWidth("あ", 5)).toBe("   あ"));
  it("padEndWidth", () => expect(padEndWidth("あA", 5)).toBe("あA  "));
});

describe("wrapText", () => {
  it("word boundary", () => expect(wrapText("the quick brown fox jumps over", 10)).toEqual(["the quick", "brown fox", "jumps over"]));
  it("CJK hard-break", () => expect(wrapText("あいうえおかきくけこ", 6)).toEqual(["あいう", "えおか", "きくけ", "こ"]));
  it("keeps newlines", () => expect(wrapText("a\nb", 10)).toEqual(["a", "b"]));
});

describe("highlight", () => {
  it("case-insensitive matches", () => {
    const h = highlight("Hello World hello", "hello");
    expect(h.filter((x) => x.match).length).toBe(2);
    expect(h.map((x) => x.text).join("")).toBe("Hello World hello");
  });
  it("empty query", () => expect(highlight("abc", "")).toEqual([{ text: "abc", match: false }]));
  it("case-sensitive", () => expect(highlight("Hello hello", "hello", { caseSensitive: true }).filter((x) => x.match).length).toBe(1));
});

describe("parseTemplate", () => {
  it("interpolates", () => expect(parseTemplate("Hi {name}, {n}", { name: "T", n: 3 })).toBe("Hi T, 3"));
  it("keeps missing", () => expect(parseTemplate("{a}{b}", { a: "x" })).toBe("x{b}"));
  it("drops missing when false", () => expect(parseTemplate("{a}{b}", { a: "x" }, { keepMissing: false })).toBe("x"));
});

describe("id", () => {
  it("randomString length/charset", () => { const s = randomString(16); expect(s.length).toBe(16); expect(s).toMatch(/^[A-Za-z0-9]+$/); });
  it("nanoid default 21 url-safe", () => { const n = nanoid(); expect(n.length).toBe(21); expect(n).toMatch(/^[A-Za-z0-9_-]+$/); });
  it("unique", () => expect(randomString(24)).not.toBe(randomString(24)));
});

describe("highlightTerms", () => {
  it("multi-word", () => {
    const h = highlightTerms("the quick brown fox", "quick fox");
    expect(h.filter((x) => x.match).map((x) => x.text)).toEqual(["quick", "fox"]);
  });
  it("merges overlaps", () => expect(highlightTerms("aaaa", ["aa", "aaa"]).filter((x) => x.match).length).toBe(1));
  it("case-insensitive", () => expect(highlightTerms("Foo foo", "foo").filter((x) => x.match).length).toBe(2));
  it("no match", () => expect(highlightTerms("abc", "xyz")).toEqual([{ text: "abc", match: false }]));
});
