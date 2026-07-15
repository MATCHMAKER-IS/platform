import { describe, it, expect } from "vitest";
import { createSearch, createMemorySearch } from "./index.js";

describe("search (memory)", () => {
  it("索引→検索でヒットする", async () => {
    const search = createSearch(createMemorySearch());
    await search.index([
      { id: "1", title: "請求書の書き方", body: "請求書は月末に発行します" },
      { id: "2", title: "経費精算", body: "領収書を添付してください" },
    ]);
    const res = await search.search("請求書");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBeGreaterThan(0);
      expect(res.value[0]?.document.id).toBe("1");
    }
  });

  it("削除すると検索に出ない", async () => {
    const search = createSearch(createMemorySearch());
    await search.index([{ id: "1", title: "テスト文書" }]);
    await search.delete(["1"]);
    const res = await search.search("テスト");
    expect(res.ok && res.value).toHaveLength(0);
  });
});
