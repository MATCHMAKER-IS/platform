import { describe, it, expect } from "vitest";
import {
  findGrade, roundPremium, isLongTermCareTarget, calcInsuranceDeduction, calcTotalLaborCost,
  HEALTH_INSURANCE_GRADES, PENSION_GRADES, REFERENCE_RATES_2026_TOKYO,
} from "./insurance";

describe("findGrade(標準報酬月額の等級)", () => {
  it("境目は「以上・未満」で判定する", () => {
    // 210,000 ちょうどは 15 等級（210,000 以上 230,000 未満）
    expect(findGrade(210_000, PENSION_GRADES).standardMonthly).toBe(220_000);
    // 209,999 は 14 等級
    expect(findGrade(209_999, PENSION_GRADES).standardMonthly).toBe(200_000);
  });

  it("**厚生年金は 65 万円で頭打ち**（それ以上いくら稼いでも保険料は増えない）", () => {
    expect(findGrade(650_000, PENSION_GRADES).standardMonthly).toBe(650_000);
    expect(findGrade(2_000_000, PENSION_GRADES).standardMonthly).toBe(650_000);
    expect(findGrade(2_000_000, PENSION_GRADES).grade).toBe(32);
  });

  it("健康保険は厚生年金より上まで等級がある（139 万円）", () => {
    expect(findGrade(2_000_000, HEALTH_INSURANCE_GRADES).standardMonthly).toBe(1_390_000);
  });

  it("0 円や負でも落ちない（最下位の等級）", () => {
    expect(findGrade(0, PENSION_GRADES).grade).toBe(1);
    expect(findGrade(-100, PENSION_GRADES).grade).toBe(1);
  });
});

describe("roundPremium(保険料の端数)", () => {
  it("**50 銭ちょうどは切り捨て**（四捨五入ではない）", () => {
    expect(roundPremium(100.5)).toBe(100);
    expect(roundPremium(100.51)).toBe(101);
    expect(roundPremium(100.49)).toBe(100);
  });
});

describe("isLongTermCareTarget(介護保険の対象)", () => {
  it("**40 歳の誕生日の前日が属する月から**対象", () => {
    // 1986-04-02 生まれ → 40 歳到達は 2026-04-01 → 4 月から
    expect(isLongTermCareTarget("1986-04-02", "2026-03")).toBe(false);
    expect(isLongTermCareTarget("1986-04-02", "2026-04")).toBe(true);
  });

  it("**1 日生まれは前月から**（前日が前月末になるため）", () => {
    // 1986-04-01 生まれ → 40 歳到達は 2026-03-31 → 3 月から
    expect(isLongTermCareTarget("1986-04-01", "2026-03")).toBe(true);
  });

  it("65 歳になると対象外（以降は年金から天引き）", () => {
    expect(isLongTermCareTarget("1961-04-02", "2026-03")).toBe(true);
    expect(isLongTermCareTarget("1961-04-02", "2026-04")).toBe(false);
  });

  it("不正な日付でも落ちない", () => {
    expect(isLongTermCareTarget("not-a-date", "2026-04")).toBe(false);
  });
});

describe("calcInsuranceDeduction(天引き額)", () => {
  const rates = REFERENCE_RATES_2026_TOKYO;

  it("**労使折半**なので、全体の料率の半分になる", () => {
    const d = calcInsuranceDeduction(
      { monthlyPay: 300_000, birthDate: "1990-05-15", targetMonth: "2026-08" },
      rates,
    );
    // 標準報酬 300,000 × 18.3% ÷ 2 = 27,450
    expect(d.pension).toBe(27_450);
    expect(d.pensionStandardMonthly).toBe(300_000);
  });

  it("**額面ではなく標準報酬月額**に料率を掛ける", () => {
    // 305,000 円でも、標準報酬は 300,000 円（19 等級）
    const d = calcInsuranceDeduction(
      { monthlyPay: 305_000, birthDate: "1990-05-15", targetMonth: "2026-08" },
      rates,
    );
    expect(d.pensionStandardMonthly).toBe(300_000);
    expect(d.pension).toBe(27_450); // 305,000 で計算すると 27,908 になってしまう
  });

  it("40 歳未満は介護保険料が 0", () => {
    const young = calcInsuranceDeduction(
      { monthlyPay: 300_000, birthDate: "2000-01-01", targetMonth: "2026-08" },
      rates,
    );
    expect(young.longTermCare).toBe(0);
  });

  it("40 歳以上は介護保険料が上乗せされる", () => {
    const older = calcInsuranceDeduction(
      { monthlyPay: 300_000, birthDate: "1980-01-01", targetMonth: "2026-08" },
      rates,
    );
    expect(older.longTermCare).toBeGreaterThan(0);
    // 300,000 × 1.59% ÷ 2 = 2,385
    expect(older.longTermCare).toBe(2_385);
  });

  it("**雇用保険は額面に直接**掛ける（等級を使わない）", () => {
    const d = calcInsuranceDeduction(
      { monthlyPay: 305_000, birthDate: "1990-05-15", targetMonth: "2026-08" },
      rates,
    );
    // 305,000 × 0.55% = 1,677.5 → **50 銭ちょうどは切り捨て**（四捨五入なら 1,678 になる）
    expect(d.employmentInsurance).toBe(1_677);
  });

  it("合計は内訳の和と一致する", () => {
    const d = calcInsuranceDeduction(
      { monthlyPay: 400_000, birthDate: "1980-01-01", targetMonth: "2026-08" },
      rates,
    );
    expect(d.total).toBe(d.health + d.longTermCare + d.pension + d.employmentInsurance);
  });

  it("高給でも厚生年金は頭打ちになる", () => {
    const a = calcInsuranceDeduction({ monthlyPay: 700_000, birthDate: "1990-01-01", targetMonth: "2026-08" }, rates);
    const b = calcInsuranceDeduction({ monthlyPay: 2_000_000, birthDate: "1990-01-01", targetMonth: "2026-08" }, rates);
    expect(a.pension).toBe(b.pension); // 厚生年金は同額
    expect(b.health).toBeGreaterThan(a.health); // 健康保険はまだ増える
  });
});

describe("calcTotalLaborCost(会社負担を含む)", () => {
  it("会社も同額を負担する（雇用保険を除く）", () => {
    const c = calcTotalLaborCost(
      { monthlyPay: 300_000, birthDate: "1990-05-15", targetMonth: "2026-08" },
      REFERENCE_RATES_2026_TOKYO,
      0.009,
    );
    expect(c.total).toBe(c.employee + c.employer);
    // **会社負担の方が大きい**（雇用保険の料率が本人より高いため）
    expect(c.employer).toBeGreaterThan(c.employee);
  });
});
