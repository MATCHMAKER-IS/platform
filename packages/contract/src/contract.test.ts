import { describe, it, expect } from "vitest";
import { isInEffect, daysUntilEnd, noticeDeadline, canGiveNotice, contractAlerts, renew, summarizeContracts, type Contract } from "./contract.js";

const mk = (o: Partial<Contract> & { id: string }): Contract => ({
  title: "契約", partner: "A社", status: "active", startDate: "2026-01-01", endDate: "2026-12-31",
  renewalType: "manual", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", ...o,
});
const today = new Date("2026-07-15T00:00:00Z");

describe("期間", () => {
  it("状態ではなく日付で有効期間を判定する", () => {
    expect(isInEffect(mk({ id: "1" }), today)).toBe(true);
    expect(isInEffect(mk({ id: "1", endDate: "2026-06-30" }), today)).toBe(false);
  });

  it("残り日数(過ぎていれば負)", () => {
    expect(daysUntilEnd(mk({ id: "1", endDate: "2026-07-20" }), today)).toBe(5);
    expect(daysUntilEnd(mk({ id: "1", endDate: "2026-07-10" }), today)).toBe(-5);
  });
});

describe("解約予告(実務で最も問題になる)", () => {
  it("終了日から予告期間を引いた日が期限", () => {
    expect(noticeDeadline(mk({ id: "1", endDate: "2026-12-31", noticeDays: 90 }))).toBe("2026-10-02");
  });

  it("予告期間が無ければ undefined(いつでも申し出られる)", () => {
    expect(noticeDeadline(mk({ id: "1" }))).toBeUndefined();
    expect(canGiveNotice(mk({ id: "1" }), today)).toBe(true);
  });

  it("期限を過ぎたら申し出られない", () => {
    expect(canGiveNotice(mk({ id: "1", endDate: "2026-08-01", noticeDays: 90 }), today)).toBe(false);
  });
});

describe("アラート", () => {
  it("自動更新の予告期限が迫るものを danger にする", () => {
    const a = contractAlerts([mk({ id: "1", renewalType: "auto", renewalMonths: 12, noticeDays: 90, endDate: "2026-11-01" })], today);
    expect(a[0]?.level).toBe("danger");
    expect(a[0]?.action).toContain("自動更新");
  });

  it("予告期限を過ぎたものは info(もう手遅れ)", () => {
    const a = contractAlerts([mk({ id: "1", renewalType: "auto", renewalMonths: 12, noticeDays: 90, endDate: "2026-10-10" })], today);
    expect(a[0]?.level).toBe("info");
  });

  it("終了日を過ぎて active のままを検出する", () => {
    const a = contractAlerts([mk({ id: "1", endDate: "2026-06-01" })], today);
    expect(a.some((x) => x.message.includes("過ぎていますが"))).toBe(true);
  });

  it("下書き・余裕のあるものは出さない", () => {
    const a = contractAlerts([mk({ id: "1", status: "draft" }), mk({ id: "2", endDate: "2027-06-01" })], today);
    expect(a).toHaveLength(0);
  });
});

describe("更新", () => {
  it("翌日から n ヶ月後の前日まで", () => {
    const r = renew(mk({ id: "1", renewalType: "auto", renewalMonths: 12 }));
    expect(r.startDate).toBe("2027-01-01");
    expect(r.endDate).toBe("2027-12-31");
  });

  it("更新しない契約・期間未設定はエラー", () => {
    expect(() => renew(mk({ id: "1", renewalType: "none" }))).toThrow(/更新できません/);
    expect(() => renew(mk({ id: "1", renewalType: "auto" }))).toThrow(/renewalMonths/);
  });
});

describe("集計", () => {
  it("件数・期限切れ・取引先別", () => {
    const s = summarizeContracts([
      mk({ id: "1", amount: 100 }), mk({ id: "2", partner: "B社", amount: 200 }), mk({ id: "3", status: "draft" }),
    ], today);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.activeAmount).toBe(300);
    expect(s.byPartner).toHaveLength(2);
  });

  it("空でも壊れない", () => {
    expect(summarizeContracts([]).total).toBe(0);
  });
});
