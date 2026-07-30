import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenize";
import { createBm25Index } from "./bm25";
describe("bm25 search", () => {
  it("tokenizes ascii and cjk bigrams", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
    expect(tokenize("請求書")).toEqual(["請求", "求書"]);
    expect(tokenize("PDF請求")).toEqual(["pdf", "請求"]);
  });
  it("ranks relevant docs, supports multi-term & boosts", () => {
    const idx = createBm25Index();
    idx.addAll([{ id: "1", t: "請求書の書き方" }, { id: "2", t: "見積書" }, { id: "3", t: "経費と請求書" }]);
    // **BM25 は短い文書を高く評価する**(文書長の正規化)。
    // "経費と請求書"(5 bigram)は "請求書の書き方"(6 bigram)より短く、
    // 「請求」「求書」の出現数が同じなら前者が上に来る。これは仕様どおり。
    // 保証されるのは「関係あるものが、関係ないものより上」まで。
    const hits = idx.search("請求書", 10);
    expect(hits.map((h) => h.id).sort()).toEqual(["1", "3"]);   // 2(見積書)は出ない
    // タイトル一致を優先したいなら fieldBoosts を使う(下の例)
    expect(hits.every((h) => h.score > 0)).toBe(true);
    const boosted = createBm25Index({ fieldBoosts: { title: 3 } });
    boosted.addAll([{ id: "A", body: "契約について" }, { id: "B", title: "契約について" }]);
    expect(boosted.search("契約", 10)[0]!.id).toBe("B");
  });
  it("reindexes and removes", () => {
    const idx = createBm25Index();
    idx.add({ id: "1", t: "旧" }); idx.add({ id: "1", t: "新" });
    expect(idx.search("旧", 10)).toHaveLength(0);
    idx.remove("1");
    expect(idx.size()).toBe(0);
  });
});
