import { describe, it, expect } from "vitest";
import { createNotionClient } from "./index";

const rawPage = {
  id: "p1", url: "https://notion/p1", created_time: "2026-01-01", last_edited_time: "2026-01-02",
  properties: {
    名前: { type: "title", title: [{ plain_text: "月次締め" }] },
    状態: { type: "status", status: { name: "進行中" } },
    タグ: { type: "multi_select", multi_select: [{ name: "経理" }, { name: "急ぎ" }] },
    完了: { type: "checkbox", checkbox: false },
    期日: { type: "date", date: { start: "2026-07-31" } },
  },
};

describe("createNotionClient", () => {
  it("入れ子のプロパティを平たい値にして返す", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ results: [rawPage], next_cursor: null }), { status: 200 })) as unknown as typeof fetch;
    const { pages, nextCursor } = await createNotionClient("ntn_x", fetchImpl).queryDatabase({ databaseId: "db1" });
    expect(pages[0]).toMatchObject({
      title: "月次締め",
      properties: { 状態: "進行中", タグ: ["経理", "急ぎ"], 完了: false, 期日: "2026-07-31" },
    });
    expect(nextCursor).toBeNull();
  });

  it("404 のときは共有忘れの可能性を伝える(最も多いつまずき)", async () => {
    const fetchImpl = (async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    await expect(createNotionClient("x", fetchImpl).getPageText("p1")).rejects.toThrow(/共有/);
  });
});
