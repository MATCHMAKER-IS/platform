import { describe, it, expect } from "vitest";
import { calcPay, aggregateMonthly } from "./premium";
const w = 1000;
describe("premium pay (labor standards)", () => {
  it("applies compound premium rates", () => {
    expect(calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 0 }).total).toBe(8000);
    expect(calcPay({ hourlyWage: w, totalMinutes: 600, overtimeMinutes: 120, nightMinutes: 0, holidayMinutes: 0 }).total).toBe(10500); // +25%
    expect(calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 120, nightMinutes: 120, holidayMinutes: 0 }).total).toBe(3000); // 1.5x
    expect(calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 480 }).total).toBe(10800); // 1.35x
    expect(calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 0, nightMinutes: 120, holidayMinutes: 120 }).total).toBe(3200); // 1.6x
  });
  it("applies over-60h monthly overtime premium", () => {
    const r = calcPay({ hourlyWage: w, totalMinutes: 70 * 60, overtimeMinutes: 70 * 60, nightMinutes: 0, holidayMinutes: 0, over60Minutes: 10 * 60 });
    expect(r.overtimePremium).toBe(15000);
    expect(r.over60Premium).toBe(5000);
  });
  it("aggregates monthly and derives over-60h", () => {
    const days = Array.from({ length: 22 }, () => ({ totalMinutes: 660, overtimeMinutes: 180, nightMinutes: 0, holidayMinutes: 0 }));
    const m = aggregateMonthly(days);
    expect(m.overtimeMinutes).toBe(66 * 60);
    expect(m.over60Minutes).toBe(6 * 60);
    expect(m.workedDays).toBe(22);
  });
});

// **内訳を足すと総支給になること。** 給与明細で最も問い合わせが来るのがここ
// (「計算が違う」と言われて、説明もできない)。
// 2026-08 に「丸める前の値から total を出していた」不具合を直した際の回帰テスト。
describe("内訳と合計が必ず一致する", () => {
  // **端数の出やすい組み合わせ**を総当たりで確かめる。
  // 時給 990 円・残業 13 分で実際に 1 円ずれていた
  const wages = [990, 1013, 1234, 1500, 2001];
  const overtimes = [1, 7, 13, 29, 61, 119];

  for (const hourlyWage of wages) {
    for (const overtimeMinutes of overtimes) {
      it(`時給 ${hourlyWage} 円・残業 ${overtimeMinutes} 分`, () => {
        const bd = calcPay({
          hourlyWage,
          totalMinutes: 9600 + overtimeMinutes,
          overtimeMinutes,
          nightMinutes: 17,
          holidayMinutes: 43,
        });
        const sum = bd.base + bd.overtimePremium + bd.over60Premium + bd.nightPremium + bd.holidayPay;
        expect(bd.total).toBe(sum);
        // **すべて整数**(円未満が残ると、明細に小数が出る)
        for (const v of [bd.base, bd.overtimePremium, bd.over60Premium, bd.nightPremium, bd.holidayPay, bd.total]) {
          expect(Number.isInteger(v)).toBe(true);
        }
      });
    }
  }
});

