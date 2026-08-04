import { describe, it, expect } from "vitest";
import {
  appliesSubcontractAct, checkSubcontractCompliance, paymentDeadline, lateInterest,
  PAYMENT_DEADLINE_DAYS, LATE_INTEREST_RATE, type SubcontractOrder,
} from "./subcontract-act";

const today = new Date("2026-08-03");

describe("appliesSubcontractAct(適用の判定)", () => {
  it("**中小企業同士でも適用される**（1,000 万円の区分）", () => {
    // 資本金 5,000 万円 → 500 万円
    expect(appliesSubcontractAct({ type: "program", ownCapital: 50_000_000, partnerCapital: 5_000_000 }).applies).toBe(true);
  });

  it("相手も 1,000 万円超なら適用されない", () => {
    expect(appliesSubcontractAct({ type: "program", ownCapital: 50_000_000, partnerCapital: 20_000_000 }).applies).toBe(false);
  });

  it("**プログラム作成は 3 億円**の基準", () => {
    // 3 億円超 → 3 億円以下
    expect(appliesSubcontractAct({ type: "program", ownCapital: 400_000_000, partnerCapital: 200_000_000 }).applies).toBe(true);
    // 1 億円 → 6,000 万円は、どちらの区分にも当てはまらない
    expect(appliesSubcontractAct({ type: "program", ownCapital: 100_000_000, partnerCapital: 60_000_000 }).applies).toBe(false);
  });

  it("**情報成果物作成は 5,000 万円**の基準（同じ IT でも分かれる）", () => {
    // 5,000 万円超 → 5,000 万円以下
    expect(appliesSubcontractAct({ type: "creative", ownCapital: 100_000_000, partnerCapital: 40_000_000 }).applies).toBe(true);
  });

  it("自社の資本金が 1,000 万円以下なら適用されない", () => {
    expect(appliesSubcontractAct({ type: "program", ownCapital: 10_000_000, partnerCapital: 5_000_000 }).applies).toBe(false);
  });

  it("理由を返す（なぜそう判断したかが分かる）", () => {
    const r = appliesSubcontractAct({ type: "program", ownCapital: 50_000_000, partnerCapital: 5_000_000 });
    expect(r.reason).toContain("1,000 万円");
  });
});

describe("paymentDeadline(支払期日の上限)", () => {
  it("**受領から 60 日（暦日）**", () => {
    expect(PAYMENT_DEADLINE_DAYS).toBe(60);
    expect(paymentDeadline("2026-01-01")).toBe("2026-03-02");
  });

  it("**「翌々月末払い」は月によって 60 日を超える**", () => {
    // 1/31 受領 → 上限は 4/1。翌々月末（3/31）は間に合うが…
    expect(paymentDeadline("2026-01-31")).toBe("2026-04-01");
    // 3/31 受領 → 上限は 5/30。翌々月末（5/31）は**超える**
    expect(paymentDeadline("2026-03-31")).toBe("2026-05-30");
  });
});

describe("lateInterest(遅延利息)", () => {
  it("**年 14.6%**（法定）", () => {
    expect(LATE_INTEREST_RATE).toBe(0.146);
    expect(lateInterest(1_000_000, "2026-03-31", "2026-04-30")).toBe(12_000);
  });

  it("遅れていなければ 0", () => {
    expect(lateInterest(1_000_000, "2026-03-31", "2026-03-31")).toBe(0);
    expect(lateInterest(1_000_000, "2026-03-31", "2026-03-01")).toBe(0);
  });
});

describe("checkSubcontractCompliance(義務の確認)", () => {
  it("**口頭発注は違反**（3 条書面の交付義務）", () => {
    const orders: SubcontractOrder[] = [{ id: "A", type: "program", orderedOn: "2026-05-01", amount: 1_000_000 }];
    const issues = checkSubcontractCompliance(orders, today);
    expect(issues.some((i) => i.severity === "violation" && i.message.includes("口頭発注"))).toBe(true);
  });

  it("書面の交付が遅れていれば警告", () => {
    const orders: SubcontractOrder[] = [
      { id: "A", type: "program", orderedOn: "2026-05-01", documentIssuedOn: "2026-05-10", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today).some((i) => i.severity === "warning")).toBe(true);
  });

  it("支払期日が 60 日を超えていれば違反", () => {
    const orders: SubcontractOrder[] = [
      { id: "B", type: "program", orderedOn: "2026-05-01", documentIssuedOn: "2026-05-01", receivedOn: "2026-05-31", paymentDueOn: "2026-08-31", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today).some((i) => i.message.includes("60 日"))).toBe(true);
  });

  it("期日を過ぎた未払いを挙げる", () => {
    const orders: SubcontractOrder[] = [
      { id: "C", type: "program", orderedOn: "2026-04-01", documentIssuedOn: "2026-04-01", receivedOn: "2026-06-30", paymentDueOn: "2026-07-31", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today).some((i) => i.message.includes("未払い"))).toBe(true);
  });

  it("支払が遅れた実績を挙げる", () => {
    const orders: SubcontractOrder[] = [
      { id: "D", type: "program", orderedOn: "2026-04-01", documentIssuedOn: "2026-04-01", receivedOn: "2026-05-01", paymentDueOn: "2026-06-30", paidOn: "2026-07-10", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today).some((i) => i.message.includes("遅れました"))).toBe(true);
  });

  it("正しい発注は指摘しない", () => {
    const orders: SubcontractOrder[] = [
      { id: "E", type: "program", orderedOn: "2026-04-01", documentIssuedOn: "2026-04-01", receivedOn: "2026-05-01", paymentDueOn: "2026-06-15", paidOn: "2026-06-15", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today)).toHaveLength(0);
  });

  it("違反が先に並ぶ", () => {
    const orders: SubcontractOrder[] = [
      { id: "warn", type: "program", orderedOn: "2026-05-01", documentIssuedOn: "2026-05-10", amount: 1_000_000 },
      { id: "viol", type: "program", orderedOn: "2026-05-01", amount: 1_000_000 },
    ];
    expect(checkSubcontractCompliance(orders, today)[0]?.severity).toBe("violation");
  });
});
