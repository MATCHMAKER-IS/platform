import { describe, it, expect } from "vitest";
import { moveCard, countByColumn } from "./kanban";
const cols = [{ id: "todo", cards: [{ id: "c1" }, { id: "c2" }] }, { id: "doing", cards: [{ id: "c3" }] }, { id: "done", cards: [] }];
describe("kanban logic", () => {
  it("moves cards across/within columns immutably", () => {
    expect(moveCard(cols, "c1", "doing")[1]!.cards.map((c) => c.id)).toEqual(["c3", "c1"]);
    expect(moveCard(cols, "c3", "todo", 1)[0]!.cards.map((c) => c.id)).toEqual(["c1", "c3", "c2"]);
    expect(cols[0]!.cards.length).toBe(2); // 元は不変
  });
  it("no-op for missing card; counts", () => {
    expect(moveCard(cols, "zzz", "done")).toBe(cols);
    expect(countByColumn(cols)).toEqual({ todo: 2, doing: 1, done: 0 });
  });
});
