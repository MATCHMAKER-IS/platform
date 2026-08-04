import { describe, it, expect } from "vitest";
import {
  standardBonus, calcBonusInsurance, bonusWithholdingTax, buildBonusPayment,
  BONUS_CAPS, type BonusRateTable,
} from "./bonus";
import { REFERENCE_RATES_2026_TOKYO } from "./insurance";

const rates = REFERENCE_RATES_2026_TOKYO;

/** 賞与の算出率表（甲欄・扶養 1 人の一部）。 */
const table: BonusRateTable = {
  year: "2026",
  rows: [
    { dependents: 1, from: 0, to: 94_000, rate: 0 },
    { dependents: 1, from: 94_000, to: 243_000, rate: 0.02042 },
    { dependents: 1, from: 243_000, to: Number.POSITIVE_INFINITY, rate: 0.04084 },
  ],
};

describe("standardBonus(標準賞与額)", () => {
  it("**1,000 円未満を切り捨てる**（月給の等級表とは違う）", () => {
    expect(standardBonus(456_789)).toBe(456_000);
    expect(standardBonus(456_000)).toBe(456_000);
  });

  it("1,000 円未満なら 0", () => {
    expect(standardBonus(999)).toBe(0);
  });

  it("負でも落ちない", () => {
    expect(standardBonus(-100)).toBe(0);
  });
});

describe("calcBonusInsurance(賞与の社会保険料)", () => {
  it("労使折半（標準賞与額 × 料率 ÷ 2）", () => {
    const d = calcBonusInsurance({ bonusAmount: 800_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false }, rates);
    expect(d.pension).toBe(73_200); // 800,000 × 18.3% ÷ 2
  });

  it("**厚生年金は 1 回ごとに 150 万円**まで（累計ではない）", () => {
    const d = calcBonusInsurance({ bonusAmount: 2_000_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false }, rates);
    expect(d.pensionTargetAmount).toBe(BONUS_CAPS.pensionPerPayment);
    expect(d.cappedByLimit).toBe(true);
  });

  it("**健康保険は年度累計で 573 万円**まで（既に使った分を差し引く）", () => {
    const d = calcBonusInsurance({ bonusAmount: 1_000_000, yearlyBonusSoFar: 5_500_000, isLongTermCareTarget: false }, rates);
    expect(d.healthTargetAmount).toBe(230_000); // 573万 - 550万
  });

  it("年度累計が上限に達していれば健康保険料は 0", () => {
    const d = calcBonusInsurance({ bonusAmount: 1_000_000, yearlyBonusSoFar: 5_730_000, isLongTermCareTarget: false }, rates);
    expect(d.health).toBe(0);
    expect(d.pension).toBeGreaterThan(0); // 厚年は別枠なのでかかる
  });

  it("40 歳未満は介護保険料が 0", () => {
    const d = calcBonusInsurance({ bonusAmount: 800_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false }, rates);
    expect(d.longTermCare).toBe(0);
  });

  it("**雇用保険は上限が無く、額面に直接**掛ける", () => {
    const d = calcBonusInsurance({ bonusAmount: 2_000_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false }, rates);
    // 上限で切られる保険料と違い、200 万円全体に掛かる
    expect(d.employmentInsurance).toBe(Math.floor(2_000_000 * rates.employmentInsurance));
  });
});

describe("bonusWithholdingTax(賞与の源泉徴収)", () => {
  it("**前月の給与**で税率が決まる（賞与額ではない）", () => {
    const low = bonusWithholdingTax(table, { bonusAfterInsurance: 700_000, previousMonthPay: 200_000, dependents: 1 });
    const high = bonusWithholdingTax(table, { bonusAfterInsurance: 700_000, previousMonthPay: 300_000, dependents: 1 });
    // 賞与額は同じでも、前月の給与が高い方が税額も高い
    expect(high).toBeGreaterThan(low);
    expect(low).toBe(Math.floor(700_000 * 0.02042));
    expect(high).toBe(Math.floor(700_000 * 0.04084));
  });

  it("前月の給与が低ければ税率 0", () => {
    expect(bonusWithholdingTax(table, { bonusAfterInsurance: 700_000, previousMonthPay: 50_000, dependents: 1 })).toBe(0);
  });

  it("表に無い組み合わせなら例外（黙って 0 を返さない）", () => {
    expect(() => bonusWithholdingTax(table, { bonusAfterInsurance: 100, previousMonthPay: 100, dependents: 3 })).toThrow();
  });
});

describe("buildBonusPayment(手取りまで)", () => {
  it("賞与 − 社会保険料 → 源泉徴収 → 手取り の順で計算する", () => {
    const p = buildBonusPayment(
      { bonusAmount: 800_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false, previousMonthPay: 255_930, dependents: 1 },
      rates, table,
    );
    expect(p.grossAmount).toBe(800_000);
    expect(p.netAmount).toBe(800_000 - p.totalDeduction);
    expect(p.totalDeduction).toBe(p.socialInsurance + p.incomeTax);
  });

  it("**住民税は引かない**（月給から年 12 回で引くため）", () => {
    const p = buildBonusPayment(
      { bonusAmount: 800_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false, previousMonthPay: 255_930, dependents: 1 },
      rates, table,
    );
    // 内訳は社会保険料と所得税だけ
    expect(p.totalDeduction).toBe(p.socialInsurance + p.incomeTax);
  });
});
