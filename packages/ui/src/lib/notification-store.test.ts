import { describe, it, expect } from "vitest";
import { notificationReducer } from "./notification-store";
import { unreadCount } from "./notifications";
describe("ui notification-store", () => {
  it("applies actions immutably", () => {
    let st = [{ id: "1", title: "A", createdAt: "2025-07-25T09:00:00Z" }, { id: "2", title: "B", createdAt: "2025-07-25T11:00:00Z", read: true }];
    st = notificationReducer(st, { type: "receive", notification: { id: "3", title: "C", createdAt: "2025-07-25T12:00:00Z" } });
    expect(st.map((n) => n.id)).toEqual(["3", "2", "1"]);
    st = notificationReducer(st, { type: "receive", notification: { id: "3", title: "C2", createdAt: "2025-07-25T13:00:00Z" } });
    expect(st.filter((n) => n.id === "3")).toHaveLength(1);
    st = notificationReducer(st, { type: "read", id: "1" });
    expect(st.find((n) => n.id === "1")!.read).toBe(true);
    expect(unreadCount(notificationReducer(st, { type: "readAll" }))).toBe(0);
    expect(notificationReducer(st, { type: "remove", id: "2" }).some((n) => n.id === "2")).toBe(false);
  });
  it("caps to max", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: String(i), title: "n", createdAt: `2025-07-0${i + 1}T00:00:00Z` }));
    expect(notificationReducer([], { type: "set", notifications: many }, { max: 3 }).map((n) => n.id)).toEqual(["4", "3", "2"]);
  });
});
