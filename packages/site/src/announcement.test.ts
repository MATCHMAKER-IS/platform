import { describe, it, expect } from "vitest";
import { isAnnouncementActive, activeAnnouncements, topAnnouncement } from "./announcement.js";
const now = new Date("2025-07-25T12:00:00Z");
const anns = [
  { id: "1", message: "通常", level: "info" as const },
  { id: "2", message: "期間外", startAt: "2025-08-01T00:00:00Z" },
  { id: "3", message: "セール", endAt: "2025-12-31T00:00:00Z", level: "sale" as const },
  { id: "4", message: "商品のみ", paths: ["/products"], level: "warning" as const },
];
describe("announcement", () => {
  it("filters by window and path", () => {
    expect(isAnnouncementActive(anns[0]!, "/", now)).toBe(true);
    expect(isAnnouncementActive(anns[1]!, "/", now)).toBe(false);
    expect(isAnnouncementActive(anns[3]!, "/products/a", now)).toBe(true);
    expect(isAnnouncementActive(anns[3]!, "/about", now)).toBe(false);
    expect(activeAnnouncements(anns, "/", { now }).map((a) => a.id)).toEqual(["1", "3"]);
    expect(activeAnnouncements(anns, "/", { now, dismissedIds: ["1"] }).map((a) => a.id)).toEqual(["3"]);
  });
  it("picks top by level", () => {
    expect(topAnnouncement(anns, "/products", { now })!.id).toBe("3");
  });
});
