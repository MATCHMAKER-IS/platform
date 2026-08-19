import { describe, it, expect } from "vitest";
import { isQuietHour, resolveDelivery, partitionDeliveries, summarizeDigest, type NotificationPreference } from "./preferences";
const at = (h: number) => { const d = new Date("2025-07-25T00:00:00"); d.setHours(h); return d; };
// **`as const` は `readonly` も付ける。**
// リテラル型が欲しくて付けたが、`NotificationPreference` は可変配列を要求するので
// 代入できない。型注釈を付ければ、リテラルは推論され `readonly` も付かない
// (2026-08、型検査が回っていなかったため食い違ったまま通っていた)。
const pref: NotificationPreference = {
  categories: {
    approval: { channels: ["slack", "email"], mode: "immediate" as const },
    report: { channels: ["email"], mode: "digest" as const },
    marketing: { channels: ["email"], mode: "off" as const },
    mention: { channels: ["push"] as const },
  },
  defaultChannels: ["inApp"],
  quietHours: { start: 22, end: 7 },
};
describe("notification preferences", () => {
  it("handles quiet hours with wrap-around", () => {
    expect(isQuietHour({ start: 22, end: 7 }, at(23))).toBe(true);
    expect(isQuietHour({ start: 22, end: 7 }, at(12))).toBe(false);
    expect(isQuietHour({ start: 22, end: 7 }, at(5))).toBe(true);
  });
  it("resolves delivery by mode, quiet hours, urgency", () => {
    expect(resolveDelivery(pref, { category: "approval" }, at(12)).reason).toBe("immediate");
    expect(resolveDelivery(pref, { category: "report" }, at(12)).deferred).toBe(true);
    expect(resolveDelivery(pref, { category: "marketing" }, at(12)).reason).toBe("off");
    expect(resolveDelivery(pref, { category: "mention" }, at(23)).reason).toBe("quiet_hours");
    expect(resolveDelivery(pref, { category: "mention", urgent: true }, at(23)).reason).toBe("urgent");
  });
  it("partitions and summarizes", () => {
    const part = partitionDeliveries(pref, [{ category: "approval" }, { category: "report" }, { category: "marketing" }, { category: "mention" }], at(12));
    expect([part.immediate.length, part.deferred.length, part.suppressed.length]).toEqual([2, 1, 1]);
    expect(summarizeDigest([{ event: { category: "report" }, decision: {} as never }, { event: { category: "report" }, decision: {} as never }])[0]).toEqual({ category: "report", count: 2 });
  });
});
