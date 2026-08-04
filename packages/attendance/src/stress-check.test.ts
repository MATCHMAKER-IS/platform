import { describe, it, expect } from "vitest";
import {
  scoreStressCheck, aggregateByGroup, checkCompliance,
  DEFAULT_CRITERIA, MIN_GROUP_SIZE, type StressQuestion, type StressScore,
} from "./stress-check";

/** B（心身のストレス反応）だけの簡略な設問。 */
const responseQs: StressQuestion[] = Array.from({ length: 29 }, (_, i) => ({ no: i + 1, area: "response" }));

describe("scoreStressCheck(採点)", () => {
  it("**逆転設問は 5 から引く**（向きを間違えると判定が真逆になる）", () => {
    const qs: StressQuestion[] = [
      { no: 1, area: "workload" },
      { no: 2, area: "workload", reversed: true },
    ];
    // 4 + (5 - 4) = 5
    expect(scoreStressCheck(qs, { 1: 4, 2: 4 }).workload).toBe(5);
  });

  it("未回答を挙げる（揃っていないと判定は信頼できない）", () => {
    const s = scoreStressCheck([{ no: 1, area: "workload" }, { no: 2, area: "response" }], { 1: 3 });
    expect(s.missing).toEqual([2]);
  });

  it("範囲外の回答は未回答として扱う", () => {
    expect(scoreStressCheck([{ no: 1, area: "workload" }], { 1: 5 }).missing).toEqual([1]);
    expect(scoreStressCheck([{ no: 1, area: "workload" }], { 1: 0 }).missing).toEqual([1]);
  });

  it("B が 77 点以上なら単独で高ストレス", () => {
    const all3 = Object.fromEntries(responseQs.map((q) => [q.no, 3])); // 87 点
    const s = scoreStressCheck(responseQs, all3);
    expect(s.response).toBe(87);
    expect(s.highStress).toBe(true);
    expect(s.reason).toBe("response");
  });

  it("B が 63〜76 でも、A + C が 76 以上なら高ストレス", () => {
    const qs: StressQuestion[] = [
      ...Array.from({ length: 29 }, (_, i) => ({ no: i + 1, area: "response" as const })),
      ...Array.from({ length: 17 }, (_, i) => ({ no: 100 + i, area: "workload" as const })),
      ...Array.from({ length: 9 }, (_, i) => ({ no: 200 + i, area: "support" as const })),
    ];
    const answers: Record<number, number> = {};
    // B = 29 × 2.3 ≒ 67（2 と 3 を混ぜる）
    responseQs.forEach((q, i) => { answers[q.no] = i < 20 ? 2 : 3; });
    // A = 17 × 4 = 68, C = 9 × 4 = 36 → 合計 104
    for (let i = 0; i < 17; i += 1) answers[100 + i] = 4;
    for (let i = 0; i < 9; i += 1) answers[200 + i] = 4;

    const s = scoreStressCheck(qs, answers);
    expect(s.response).toBeGreaterThanOrEqual(DEFAULT_CRITERIA.responseCombined);
    expect(s.response).toBeLessThan(DEFAULT_CRITERIA.responseAlone);
    expect(s.highStress).toBe(true);
    expect(s.reason).toBe("workload-and-support");
  });

  it("どちらの基準も満たさなければ高ストレスではない", () => {
    const all2 = Object.fromEntries(responseQs.map((q) => [q.no, 2])); // 58 点
    expect(scoreStressCheck(responseQs, all2).highStress).toBe(false);
  });
});

describe("aggregateByGroup(集団分析)", () => {
  const score: StressScore = { workload: 40, response: 60, support: 20, highStress: false, reason: "none", missing: [] };
  const highScore: StressScore = { ...score, response: 80, highStress: true, reason: "response" };

  it("**10 人未満は集計しない**（平均から個人の結果を推測できてしまう）", () => {
    const nine = Array.from({ length: 9 }, () => ({ group: "営業", score }));
    expect(aggregateByGroup(nine)).toHaveLength(0);
  });

  it("10 人以上なら集計する", () => {
    const ten = Array.from({ length: 10 }, () => ({ group: "営業", score }));
    const r = aggregateByGroup(ten);
    expect(r).toHaveLength(1);
    expect(r[0]?.count).toBe(10);
  });

  it("高ストレス者の割合を出す", () => {
    const entries = [
      ...Array.from({ length: 8 }, () => ({ group: "開発", score })),
      ...Array.from({ length: 2 }, () => ({ group: "開発", score: highScore })),
    ];
    expect(aggregateByGroup(entries)[0]?.highStressRatio).toBe(0.2);
  });

  it("**ストレスが高い集団から並べる**（改善が要る順）", () => {
    const entries = [
      ...Array.from({ length: 10 }, () => ({ group: "低", score })),
      ...Array.from({ length: 10 }, () => ({ group: "高", score: highScore })),
    ];
    expect(aggregateByGroup(entries)[0]?.group).toBe("高");
  });

  it("最小人数は 10（既定値を下げない）", () => {
    expect(MIN_GROUP_SIZE).toBe(10);
  });
});

describe("checkCompliance(実施状況)", () => {
  it("**50 人以上は義務**、50 人未満は努力義務", () => {
    expect(checkCompliance({ employeeCount: 50, checkedCount: 0 }).required).toBe(true);
    expect(checkCompliance({ employeeCount: 49, checkedCount: 0 }).required).toBe(false);
  });

  it("50 人未満なら指摘しない", () => {
    expect(checkCompliance({ employeeCount: 30, checkedCount: 0 }).issues).toEqual([]);
  });

  it("一度も実施していなければ指摘する", () => {
    const c = checkCompliance({ employeeCount: 80, checkedCount: 0 });
    expect(c.issues.some((i) => i.includes("一度も実施していません"))).toBe(true);
  });

  it("**1 年を超えたら義務違反**", () => {
    const c = checkCompliance(
      { employeeCount: 80, checkedCount: 70, lastConductedOn: "2025-01-01", reportedToLabourOffice: true },
      new Date("2026-08-03"),
    );
    expect(c.issues.some((i) => i.includes("年 1 回"))).toBe(true);
  });

  it("1 年に近づいたら先に知らせる（超えてからでは遅い）", () => {
    const c = checkCompliance(
      { employeeCount: 80, checkedCount: 70, lastConductedOn: "2025-09-01", reportedToLabourOffice: true },
      new Date("2026-08-03"),
    );
    expect(c.issues.some((i) => i.includes("1 年を超える前に"))).toBe(true);
  });

  it("労働基準監督署への報告漏れを指摘する", () => {
    const c = checkCompliance(
      { employeeCount: 80, checkedCount: 70, lastConductedOn: "2026-06-01" },
      new Date("2026-08-03"),
    );
    expect(c.issues.some((i) => i.includes("労働基準監督署"))).toBe(true);
  });

  it("受検率が低ければ確認を促す（受検は強制できない）", () => {
    const c = checkCompliance(
      { employeeCount: 80, checkedCount: 20, lastConductedOn: "2026-06-01", reportedToLabourOffice: true },
      new Date("2026-08-03"),
    );
    expect(c.participationRate).toBe(0.25);
    expect(c.issues.some((i) => i.includes("受検率"))).toBe(true);
  });
});
