import { describe, it, expect } from "vitest";
import { unreadCount, sortNotifications, markRead, markAllRead, groupByDate } from "./notifications";
const now = new Date("2025-07-25T12:00:00Z");
const list = [
  { id: "1", title: "A", createdAt: "2025-07-25T09:00:00Z" },
  { id: "2", title: "B", createdAt: "2025-07-25T11:00:00Z", read: true },
  { id: "3", title: "C", createdAt: "2025-07-24T10:00:00Z" },
  { id: "4", title: "D", createdAt: "2025-07-20T10:00:00Z" },
];
describe("ui notifications lib", () => {
  it("counts, sorts, marks", () => {
    expect(unreadCount(list)).toBe(3);
    expect(sortNotifications(list).map((x) => x.id)).toEqual(["2", "1", "3", "4"]);
    const r = markRead(list, "1");
    expect(r.find((x) => x.id === "1")!.read).toBe(true);
    expect(list.find((x) => x.id === "1")!.read).toBeUndefined();
    expect(unreadCount(markAllRead(list))).toBe(0);
  });
  it("groups by date", () => {
    const g = groupByDate(list, now);
    expect(g.today.map((x) => x.id)).toEqual(["2", "1"]);
    expect(g.yesterday.map((x) => x.id)).toEqual(["3"]);
    expect(g.earlier.map((x) => x.id)).toEqual(["4"]);
  });
});
