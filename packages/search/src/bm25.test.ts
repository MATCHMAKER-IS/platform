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
    expect(idx.search("請求書", 10)[0]!.id).toBe("1");
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
