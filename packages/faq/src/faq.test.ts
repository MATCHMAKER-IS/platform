import { describe, it, expect } from "vitest";
import { publishedOnly, searchFaq, byCategory, sortByHelpfulness, helpfulRate, needsReview, vote, summarizeFaq, type FaqItem } from "./faq.js";

const mk = (o: Partial<FaqItem> & { id: string }): FaqItem => ({
  question: "q", answer: "a", category: "経費", keywords: [], status: "published",
  helpful: 0, notHelpful: 0, views: 0, relatedIds: [],
  createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", ...o,
});

describe("検索", () => {
  const items = [
    mk({ id: "1", question: "経費の締め切りはいつ?", answer: "毎月5日です", keywords: ["精算", "期限"], helpful: 20 }),
    mk({ id: "2", question: "領収書を無くしたら?", answer: "再発行を依頼してください" }),
    mk({ id: "3", question: "下書き", answer: "x", status: "draft" }),
  ];

  it("質問文の一致を最優先する", () => {
    expect(searchFaq(items, "締め切り")[0]?.matched).toBe("質問");
  });

  it("キーワード(別の言い方)でも見つかる", () => {
    expect(searchFaq(items, "精算")[0]?.item.id).toBe("1");
  });

  it("下書きは検索に出ない", () => {
    expect(searchFaq(items, "下書き")).toHaveLength(0);
  });

  it("空クエリ・該当なしは空", () => {
    expect(searchFaq(items, "  ")).toHaveLength(0);
    expect(searchFaq(items, "zzz")).toHaveLength(0);
  });
});

describe("並べ替え", () => {
  it("票が少ない 100% より、票の多い 90% を上に出す", () => {
    const r = sortByHelpfulness([mk({ id: "a", helpful: 1 }), mk({ id: "b", helpful: 45, notHelpful: 5 })]);
    expect(r[0]?.id).toBe("b");
  });
});

describe("評価", () => {
  it("票が無ければ undefined(0% と区別する)", () => {
    expect(helpfulRate(mk({ id: "1" }))).toBeUndefined();
    expect(helpfulRate(mk({ id: "1", helpful: 1, notHelpful: 1 }))).toBe(0.5);
  });

  it("低評価と、見られているのに無投票を検出する", () => {
    const r = needsReview([
      mk({ id: "bad", helpful: 1, notHelpful: 9 }),
      mk({ id: "silent", views: 60 }),
      mk({ id: "few", helpful: 1 }),
    ]);
    expect(r.map((x) => x.item.id)).toContain("bad");
    expect(r.map((x) => x.item.id)).toContain("silent");
    expect(r.map((x) => x.item.id)).not.toContain("few"); // 票が少ないものは決めつけない
  });

  it("公開中でなければ投票できない", () => {
    expect(() => vote(mk({ id: "1", status: "draft" }), true)).toThrow(/公開中/);
  });

  it("投票は新しいオブジェクトを返す", () => {
    const item = mk({ id: "1" });
    expect(vote(item, true).helpful).toBe(1);
    expect(item.helpful).toBe(0);
  });
});

describe("集計", () => {
  it("件数・要見直し・閲覧上位を返す", () => {
    const s = summarizeFaq([mk({ id: "1", views: 100 }), mk({ id: "2", status: "draft" })]);
    expect(s.total).toBe(2);
    expect(s.published).toBe(1);
    expect(s.draft).toBe(1);
    expect(s.topViewed[0]?.id).toBe("1");
  });

  it("カテゴリは件数の多い順", () => {
    const r = byCategory([mk({ id: "1", category: "経費" }), mk({ id: "2", category: "経費" }), mk({ id: "3", category: "勤怠" })]);
    expect(r[0]?.category).toBe("経費");
  });

  it("空でも壊れない", () => {
    expect(summarizeFaq([]).helpfulRate).toBeUndefined();
    expect(publishedOnly([])).toHaveLength(0);
  });
});
