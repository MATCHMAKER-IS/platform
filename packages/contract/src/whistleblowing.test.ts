import { describe, it, expect } from "vitest";
import {
  maskReporter, canAccess, checkReportHandling, summarizeReports, checkSystem,
  NOTIFY_DEADLINE_BUSINESS_DAYS, type Report, type Handler,
} from "./whistleblowing";

const today = new Date("2026-08-03");

const namedReport: Report = {
  id: "R1", channel: "internal", receivedOn: "2026-07-01",
  reporterName: "山田", reporterDepartment: "経理部",
  content: "秘密の内容", status: "received",
};

describe("maskReporter(通報者を伏せる)", () => {
  it("**氏名も所属も落とす**（所属だけでも特定されうる）", () => {
    const m = maskReporter(namedReport);
    expect("reporterName" in m).toBe(false);
    expect("reporterDepartment" in m).toBe(false);
  });

  it("匿名かどうかは分かる", () => {
    expect(maskReporter(namedReport).anonymous).toBe(false);
    expect(maskReporter({ ...namedReport, reporterName: undefined }).anonymous).toBe(true);
  });

  it("通報の内容は残る（対応には必要）", () => {
    expect(maskReporter(namedReport).content).toBe("秘密の内容");
  });
});

describe("canAccess(従事者の判定)", () => {
  it("**書面での指定が無ければ従事者ではない**（役職では見られない）", () => {
    expect(canAccess({ id: "h1", name: "佐藤" }, today)).toBe(false);
  });

  it("指定されていれば見られる", () => {
    expect(canAccess({ id: "h1", name: "佐藤", designatedOn: "2025-01-01" }, today)).toBe(true);
  });

  it("解任後は見られない", () => {
    const h: Handler = { id: "h1", name: "佐藤", designatedOn: "2025-01-01", revokedOn: "2026-01-01" };
    expect(canAccess(h, today)).toBe(false);
  });

  it("指定日が未来なら、まだ見られない", () => {
    expect(canAccess({ id: "h1", name: "佐藤", designatedOn: "2026-12-01" }, today)).toBe(false);
  });
});

describe("checkReportHandling(対応の滞り)", () => {
  it("**20 営業日を過ぎたら緊急**（報道機関への通報が保護される）", () => {
    const issues = checkReportHandling([{ ...namedReport, receivedOn: "2026-06-01" }], today);
    expect(issues.some((i) => i.severity === "urgent" && i.message.includes("報道機関"))).toBe(true);
  });

  it("期限が近づいたら先に知らせる", () => {
    // 2026-07-06 受付 → 約 20 営業日
    const issues = checkReportHandling([{ ...namedReport, receivedOn: "2026-07-06" }], today);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("通知済みなら指摘しない", () => {
    const r: Report = { ...namedReport, receivedOn: "2026-06-01", notifiedOn: "2026-06-05", handlerId: "h1" };
    expect(checkReportHandling([r], today)).toHaveLength(0);
  });

  it("完了した通報は対象外", () => {
    const r: Report = { ...namedReport, receivedOn: "2026-01-01", status: "resolved" };
    expect(checkReportHandling([r], today)).toHaveLength(0);
  });

  it("従事者が割り当てられていなければ挙げる", () => {
    const r: Report = { ...namedReport, receivedOn: "2026-08-01", notifiedOn: "2026-08-01" };
    expect(checkReportHandling([r], today).some((i) => i.message.includes("従事者"))).toBe(true);
  });

  it("期限は 20 営業日", () => {
    expect(NOTIFY_DEADLINE_BUSINESS_DAYS).toBe(20);
  });
});

describe("summarizeReports(集計)", () => {
  const reports: Report[] = [
    { id: "R1", channel: "internal", receivedOn: "2026-05-01", closedOn: "2026-05-20", content: "秘密の内容", status: "resolved", reporterName: "A" },
    { id: "R2", channel: "external", receivedOn: "2026-08-01", content: "秘密の内容", status: "investigating" },
  ];

  it("**通報者の情報を含めない**", () => {
    expect(JSON.stringify(summarizeReports(reports))).not.toContain("A");
  });

  it("経路・状態ごとの件数を出す", () => {
    const s = summarizeReports(reports);
    expect(s.total).toBe(2);
    expect(s.byChannel.internal).toBe(1);
    expect(s.byStatus.resolved).toBe(1);
  });

  it("匿名の割合を出す", () => {
    expect(summarizeReports(reports).anonymousRatio).toBe(0.5);
  });

  it("平均対応日数は完了したものだけで計算する", () => {
    expect(summarizeReports(reports).averageDaysToClose).toBe(19);
  });

  it("通報が無くても落ちない", () => {
    expect(summarizeReports([]).anonymousRatio).toBe(0);
  });
});

describe("checkSystem(体制整備)", () => {
  const handler: Handler = { id: "h", name: "A", designatedOn: "2025-01-01" };

  it("**300 人超は義務、300 人以下は努力義務**", () => {
    expect(checkSystem({ employeeCount: 301, hasChannel: true, handlers: [handler], hasProtectionPolicy: true }, today).required).toBe(true);
    expect(checkSystem({ employeeCount: 300, hasChannel: true, handlers: [handler], hasProtectionPolicy: true }, today).required).toBe(false);
  });

  it("3 要素すべてが揃っていなければ挙げる", () => {
    const c = checkSystem({ employeeCount: 400, hasChannel: false, handlers: [], hasProtectionPolicy: false }, today);
    expect(c.issues).toHaveLength(3);
  });

  it("**指定されていない人は従事者として数えない**", () => {
    const c = checkSystem(
      { employeeCount: 400, hasChannel: true, handlers: [{ id: "h", name: "A" }], hasProtectionPolicy: true },
      today,
    );
    expect(c.issues.some((i) => i.includes("従事者"))).toBe(true);
  });

  it("揃っていれば指摘しない", () => {
    const c = checkSystem({ employeeCount: 400, hasChannel: true, handlers: [handler], hasProtectionPolicy: true }, today);
    expect(c.issues).toHaveLength(0);
  });
});
