import { describe, it, expect } from "vitest";
import {
  checkWorkerRecords, checkWageLedger, checkAttendanceRecords,
  checkRetention, retentionStartForWorker, RETENTION_YEARS,
  type WorkerRecord, type WageLedgerEntry,
} from "./legal-ledger";

const worker: WorkerRecord = {
  name: "山田", birthDate: "1990-01-01", history: "営業部", gender: "男",
  address: "東京都", hiredOn: "2020-04-01",
};

const wage: WageLedgerEntry = {
  name: "山田", gender: "男", period: "2026-07",
  workDays: 20, workHours: 160, overtimeHours: 10, nightHours: 0, holidayHours: 0,
  payments: [{ name: "基本給", amount: 300_000 }],
  deductions: [{ name: "健康保険料", amount: 15_000 }],
};

describe("checkWorkerRecords(労働者名簿)", () => {
  it("**30 人未満なら「従事する業務の種類」は省略できる**", () => {
    expect(checkWorkerRecords([worker], 20)).toHaveLength(0);
  });

  it("30 人以上なら業務の種類も必要", () => {
    const issues = checkWorkerRecords([worker], 30);
    expect(issues.some((i) => i.message.includes("従事する業務の種類"))).toBe(true);
  });

  it("必須項目の抜けを挙げる", () => {
    const issues = checkWorkerRecords([{ ...worker, address: "" }], 20);
    expect(issues.some((i) => i.message.includes("住所"))).toBe(true);
  });

  it("空白だけの値は未記載として扱う", () => {
    const issues = checkWorkerRecords([{ ...worker, history: "   " }], 20);
    expect(issues.some((i) => i.message.includes("履歴"))).toBe(true);
  });

  it("**退職したら事由も要る**（解雇なら理由まで）", () => {
    const issues = checkWorkerRecords([{ ...worker, leftOn: "2025-03-31" }], 20);
    expect(issues.some((i) => i.message.includes("事由"))).toBe(true);
  });

  it("事由が書いてあれば指摘しない", () => {
    const issues = checkWorkerRecords([{ ...worker, leftOn: "2025-03-31", leftReason: "自己都合退職" }], 20);
    expect(issues).toHaveLength(0);
  });
});

describe("checkWageLedger(賃金台帳)", () => {
  it("正しい台帳は指摘なし", () => {
    expect(checkWageLedger([wage])).toHaveLength(0);
  });

  it("**「その他」でまとめるのは不備**（種類ごとに分ける）", () => {
    const issues = checkWageLedger([{ ...wage, payments: [{ name: "その他", amount: 50_000 }] }]);
    expect(issues.some((i) => i.message.includes("種類ごとに分けて"))).toBe(true);
  });

  it("「諸手当」も同様に不備", () => {
    const issues = checkWageLedger([{ ...wage, payments: [{ name: "諸手当", amount: 50_000 }] }]);
    expect(issues.some((i) => i.message.includes("種類ごとに分けて"))).toBe(true);
  });

  it("時間数が 0 でも記載されていれば問題ない（未記載とは違う）", () => {
    expect(checkWageLedger([{ ...wage, overtimeHours: 0 }])).toHaveLength(0);
  });

  it("時間数が負や NaN なら指摘する", () => {
    expect(checkWageLedger([{ ...wage, overtimeHours: -1 }]).length).toBeGreaterThan(0);
    expect(checkWageLedger([{ ...wage, workHours: Number.NaN }]).length).toBeGreaterThan(0);
  });

  it("賃金の内訳が無ければ指摘する", () => {
    expect(checkWageLedger([{ ...wage, payments: [] }]).length).toBeGreaterThan(0);
  });
});

describe("checkAttendanceRecords(出勤簿)", () => {
  it("**「出勤」だけでは足りない**（時刻が無いと割増賃金を計算できない）", () => {
    expect(checkAttendanceRecords([{ date: "2026-07-01" }], "山田")).toHaveLength(1);
  });

  it("始業・終業が揃っていれば問題ない", () => {
    expect(checkAttendanceRecords([{ date: "2026-07-01", startTime: "09:00", endTime: "18:00" }], "山田")).toHaveLength(0);
  });

  it("休日・欠勤なら時刻は不要", () => {
    expect(checkAttendanceRecords([{ date: "2026-07-05", dayType: "法定休日" }], "山田")).toHaveLength(0);
  });

  it("片方だけでは足りない", () => {
    expect(checkAttendanceRecords([{ date: "2026-07-01", startTime: "09:00" }], "山田")).toHaveLength(1);
  });
});

describe("checkRetention(保存期間)", () => {
  const today = new Date("2026-08-03");

  it("起算日から 5 年後の前日まで", () => {
    const s = checkRetention({ kind: "wage", target: "山田", startsOn: "2025-12-31" }, today);
    expect(s.keepUntil).toBe("2030-12-30");
    expect(s.mustKeep).toBe(true);
  });

  it("期限を過ぎていれば破棄できる", () => {
    const s = checkRetention({ kind: "worker", target: "山田", startsOn: "2020-03-31" }, today);
    expect(s.mustKeep).toBe(false);
    expect(s.daysLeft).toBeLessThan(0);
  });

  it("**起算日が違えば期限も違う**（一律で消すと違反になる）", () => {
    const w = checkRetention({ kind: "worker", target: "山田", startsOn: "2020-03-31" }, today);
    const g = checkRetention({ kind: "wage", target: "山田", startsOn: "2025-12-31" }, today);
    expect(w.mustKeep).toBe(false);
    expect(g.mustKeep).toBe(true);
  });

  it("保存年数は 5 年（3 年ではなく安全側）", () => {
    expect(RETENTION_YEARS).toBe(5);
  });
});

describe("retentionStartForWorker(起算日)", () => {
  it("**在職中は起算しない**（退職するまで持ち続ける）", () => {
    expect(retentionStartForWorker(worker)).toBeUndefined();
  });

  it("退職していれば退職日から", () => {
    expect(retentionStartForWorker({ ...worker, leftOn: "2025-03-31" })).toBe("2025-03-31");
  });
});
