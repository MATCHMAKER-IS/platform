import { describe, it, expect } from "vitest";
import { buildDisclosureReport, disclosureToJson, erasePersonalData, buildErasureReceipt, recordsToErase } from "./subject-rights.js";
const categories = [
  { id: "member", name: "会員基本情報", purpose: "サービス提供", legalBasis: "契約", retentionDays: 1825, thirdParties: ["配送業者A"] },
  { id: "mkt", name: "販促情報", purpose: "ご案内", legalBasis: "同意" },
];
describe("pii subject rights (APPI)", () => {
  it("builds disclosure report with purpose/third-parties/data", () => {
    const report = buildDisclosureReport({ subjectId: "u1", entries: [{ categoryId: "member", data: { email: "y@x.com" } }, { categoryId: "mkt", data: { tags: ["a"] } }], categories, generatedAt: new Date("2025-07-25T10:00:00Z") });
    expect(report.subjectId).toBe("u1");
    expect(report.holdings[0]).toMatchObject({ category: "会員基本情報", purpose: "サービス提供", thirdParties: ["配送業者A"] });
    expect(report.holdings[0]!.data).toEqual({ email: "y@x.com" });
    expect(JSON.parse(disclosureToJson(report)).holdings).toHaveLength(2);
  });
  it("erases via anonymize or delete, tracks fields", () => {
    const rec = { id: "1", name: "山田", email: "y@x.com", orders: 5 };
    const an = erasePersonalData(rec, ["name", "email"]);
    expect(an.record).toMatchObject({ name: "[削除済み]", email: "[削除済み]", orders: 5 });
    expect(an.erasedFields).toEqual(["name", "email"]);
    const del = erasePersonalData(rec, ["name"], { method: "delete" });
    expect("name" in del.record).toBe(false);
    expect(erasePersonalData({ id: "1", name: "太郎", phone: null }, ["name", "phone"]).erasedFields).toEqual(["name"]);
  });
  it("receipts and retention purge", () => {
    expect(buildErasureReceipt("u1", ["name"], "delete", new Date("2025-07-25T10:00:00Z"))).toMatchObject({ subjectId: "u1", method: "delete" });
    const now = new Date("2025-07-25").getTime(), day = 86_400_000;
    expect(recordsToErase([{ id: "old", createdAt: now - 100 * day, retentionDays: 30 }, { id: "fresh", createdAt: now - 10 * day, retentionDays: 30 }], now)).toEqual(["old"]);
  });
});
