import { describe, it, expect } from "vitest";
import {
  requiredKinds, nextDueDate, checkCheckupStatus, summarizeCheckups,
  type CheckupTarget, type CheckupRecord,
} from "./health-checkup";

const today = new Date("2026-08-03");

const normal: CheckupTarget = { name: "山田", hiredOn: "2020-04-01" };
const nightShift: CheckupTarget = { name: "佐藤", hiredOn: "2020-04-01", specialWork: true };

describe("requiredKinds(必要な健診)", () => {
  it("通常は定期健診（1 年ごと）", () => {
    expect(requiredKinds(normal)).toEqual(["periodic"]);
  });

  it("**深夜業などの特定業務は 6 か月ごと**（年 1 回で済ませてはいけない）", () => {
    expect(requiredKinds(nightShift)).toEqual(["special"]);
  });
});

describe("nextDueDate(次回期限)", () => {
  it("**前回の受診日から起算する**（年度ではない）", () => {
    expect(nextDueDate("2025-05-20", "periodic")).toBe("2026-05-20");
  });

  it("特定業務は 6 か月後", () => {
    expect(nextDueDate("2026-05-20", "special")).toBe("2026-11-20");
  });

  it("未受診なら雇入れ日から起算", () => {
    expect(nextDueDate(undefined, "periodic", "2026-04-01")).toBe("2027-04-01");
  });

  it("月末は末日に丸める（1/31 の 1 か月後は 2/28）", () => {
    expect(nextDueDate("2026-01-31", "special").slice(0, 7)).toBe("2026-07");
  });

  it("起算日が無ければ空文字", () => {
    expect(nextDueDate(undefined, "periodic")).toBe("");
  });
});

describe("checkCheckupStatus(実施状況)", () => {
  const records: CheckupRecord[] = [
    { name: "山田", kind: "hire", examinedOn: "2020-04-01", notifiedToWorker: true },
    { name: "山田", kind: "periodic", examinedOn: "2025-05-20", notifiedToWorker: true },
  ];

  it("期限を過ぎていれば overdue", () => {
    const issues = checkCheckupStatus([normal], records, today);
    expect(issues.some((i) => i.severity === "overdue")).toBe(true);
  });

  it("期限内なら指摘しない", () => {
    const fresh: CheckupRecord[] = [
      { name: "山田", kind: "hire", examinedOn: "2020-04-01", notifiedToWorker: true },
      { name: "山田", kind: "periodic", examinedOn: "2026-06-01", notifiedToWorker: true },
    ];
    expect(checkCheckupStatus([normal], fresh, today)).toHaveLength(0);
  });

  it("期限が近づいたら先に知らせる（過ぎてからでは遅い）", () => {
    const soon: CheckupRecord[] = [
      { name: "山田", kind: "hire", examinedOn: "2020-04-01", notifiedToWorker: true },
      { name: "山田", kind: "periodic", examinedOn: "2025-09-15", notifiedToWorker: true },
    ];
    expect(checkCheckupStatus([normal], soon, today).some((i) => i.severity === "due-soon")).toBe(true);
  });

  it("**退職者は対象外**", () => {
    const left: CheckupTarget = { name: "退職者", hiredOn: "2020-04-01", leftOn: "2026-03-31" };
    expect(checkCheckupStatus([left], [], today)).toHaveLength(0);
  });

  it("雇入時健診の記録が無ければ挙げる", () => {
    expect(checkCheckupStatus([normal], [], today).some((i) => i.law.includes("第43条"))).toBe(true);
  });

  it("**本人への通知は義務**（法第66条の6）", () => {
    const noNotify: CheckupRecord[] = [
      { name: "山田", kind: "hire", examinedOn: "2020-04-01" },
      { name: "山田", kind: "periodic", examinedOn: "2026-06-01" },
    ];
    expect(checkCheckupStatus([normal], noNotify, today).some((i) => i.message.includes("本人に通知"))).toBe(true);
  });

  it("**異常所見があれば医師の意見を聴く義務**（法第66条の4）", () => {
    const abnormal: CheckupRecord[] = [
      { name: "佐藤", kind: "hire", examinedOn: "2020-04-01", notifiedToWorker: true },
      { name: "佐藤", kind: "special", examinedOn: "2026-05-20", notifiedToWorker: true, hasAbnormality: true },
    ];
    expect(checkCheckupStatus([nightShift], abnormal, today).some((i) => i.message.includes("医師の意見"))).toBe(true);
  });

  it("医師の意見を聴いていれば指摘しない", () => {
    const handled: CheckupRecord[] = [
      { name: "佐藤", kind: "hire", examinedOn: "2020-04-01", notifiedToWorker: true },
      { name: "佐藤", kind: "special", examinedOn: "2026-05-20", notifiedToWorker: true, hasAbnormality: true, doctorOpinionObtained: true },
    ];
    expect(checkCheckupStatus([nightShift], handled, today).some((i) => i.message.includes("医師の意見"))).toBe(false);
  });

  it("深刻な順に並ぶ（overdue が先）", () => {
    const mixed = checkCheckupStatus([normal, nightShift], [], today);
    expect(mixed[0]?.severity).toBe("overdue");
  });
});

describe("summarizeCheckups(実施率)", () => {
  const records: CheckupRecord[] = [
    { name: "山田", kind: "periodic", examinedOn: "2026-06-01", notifiedToWorker: true },
  ];

  it("在職者だけを数える", () => {
    const left: CheckupTarget = { name: "退職者", hiredOn: "2020-04-01", leftOn: "2026-03-31" };
    expect(summarizeCheckups([normal, left], records, 60, today).targetCount).toBe(1);
  });

  it("実施率を出す", () => {
    const s = summarizeCheckups([normal, nightShift], records, 60, today);
    expect(s.rate).toBe(0.5);
    expect(s.overdueCount).toBe(1);
  });

  it("**50 人以上は労基署への報告が必要**", () => {
    expect(summarizeCheckups([normal], records, 50, today).reportRequired).toBe(true);
    expect(summarizeCheckups([normal], records, 49, today).reportRequired).toBe(false);
  });

  it("対象者が居なくても落ちない", () => {
    expect(summarizeCheckups([], [], 10, today).rate).toBe(0);
  });
});
