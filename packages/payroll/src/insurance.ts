/**
 * 社会保険料の計算（健康保険・厚生年金・雇用保険・介護保険）。
 *
 * 給与から天引きする額は、**額面にそのまま料率を掛けるのではない**。
 * 健康保険と厚生年金は「標準報酬月額」という**等級に丸めた額**に料率を掛ける。
 * この仕組みを知らずに実装すると、毎月わずかにずれ続け、年末に大きく合わなくなる。
 *
 * 【押さえている点】
 *   - **標準報酬月額**（等級表で丸める。健保 50 等級・厚年 32 等級）
 *   - **上限がある**（厚年は 65 万円で頭打ち。高給でも保険料は増えない）
 *   - **労使折半**（会社と本人で半分ずつ。天引きするのは本人負担分だけ）
 *   - **介護保険は 40 歳から**（40 歳の誕生日の前日が属する月から）
 *   - **雇用保険は額面に直接**（等級を使わない。ここだけ仕組みが違う）
 *   - **端数は 50 銭以下切り捨て・超は切り上げ**（通貨処理法。円未満の扱い）
 *
 * 【使わない場合】
 * 料率は毎年変わり、都道府県でも違う（健康保険は協会けんぽの都道府県別料率）。
 * **料率は引数で渡す**設計にしてあるので、年度が変わったら呼び出し側で差し替える。
 * 基盤に年度別の表を埋め込むと、更新のたびに基盤を触ることになる。
 *
 * @packageDocumentation
 */

/** 標準報酬月額の等級。 */
export interface Grade {
  /** 等級番号。 */
  grade: number;
  /** 標準報酬月額（円）。 */
  standardMonthly: number;
  /** この等級に入る報酬の下限（円。以上）。 */
  from: number;
  /** この等級に入る報酬の上限（円。未満。最上位は Infinity）。 */
  to: number;
}

/**
 * 健康保険の標準報酬月額表（2026 年度・全 50 等級）。
 *
 * **等級の境目は「以上・未満」**。63,000 円未満は 1 等級、
 * 1,415,000 円以上は 50 等級で頭打ちになる。
 */
export const HEALTH_INSURANCE_GRADES: readonly Grade[] = [
  { grade: 1, standardMonthly: 58_000, from: 0, to: 63_000 },
  { grade: 2, standardMonthly: 68_000, from: 63_000, to: 73_000 },
  { grade: 3, standardMonthly: 78_000, from: 73_000, to: 83_000 },
  { grade: 4, standardMonthly: 88_000, from: 83_000, to: 93_000 },
  { grade: 5, standardMonthly: 98_000, from: 93_000, to: 101_000 },
  { grade: 6, standardMonthly: 104_000, from: 101_000, to: 107_000 },
  { grade: 7, standardMonthly: 110_000, from: 107_000, to: 114_000 },
  { grade: 8, standardMonthly: 118_000, from: 114_000, to: 122_000 },
  { grade: 9, standardMonthly: 126_000, from: 122_000, to: 130_000 },
  { grade: 10, standardMonthly: 134_000, from: 130_000, to: 138_000 },
  { grade: 11, standardMonthly: 142_000, from: 138_000, to: 146_000 },
  { grade: 12, standardMonthly: 150_000, from: 146_000, to: 155_000 },
  { grade: 13, standardMonthly: 160_000, from: 155_000, to: 165_000 },
  { grade: 14, standardMonthly: 170_000, from: 165_000, to: 175_000 },
  { grade: 15, standardMonthly: 180_000, from: 175_000, to: 185_000 },
  { grade: 16, standardMonthly: 190_000, from: 185_000, to: 195_000 },
  { grade: 17, standardMonthly: 200_000, from: 195_000, to: 210_000 },
  { grade: 18, standardMonthly: 220_000, from: 210_000, to: 230_000 },
  { grade: 19, standardMonthly: 240_000, from: 230_000, to: 250_000 },
  { grade: 20, standardMonthly: 260_000, from: 250_000, to: 270_000 },
  { grade: 21, standardMonthly: 280_000, from: 270_000, to: 290_000 },
  { grade: 22, standardMonthly: 300_000, from: 290_000, to: 310_000 },
  { grade: 23, standardMonthly: 320_000, from: 310_000, to: 330_000 },
  { grade: 24, standardMonthly: 340_000, from: 330_000, to: 350_000 },
  { grade: 25, standardMonthly: 360_000, from: 350_000, to: 370_000 },
  { grade: 26, standardMonthly: 380_000, from: 370_000, to: 395_000 },
  { grade: 27, standardMonthly: 410_000, from: 395_000, to: 425_000 },
  { grade: 28, standardMonthly: 440_000, from: 425_000, to: 455_000 },
  { grade: 29, standardMonthly: 470_000, from: 455_000, to: 485_000 },
  { grade: 30, standardMonthly: 500_000, from: 485_000, to: 515_000 },
  { grade: 31, standardMonthly: 530_000, from: 515_000, to: 545_000 },
  { grade: 32, standardMonthly: 560_000, from: 545_000, to: 575_000 },
  { grade: 33, standardMonthly: 590_000, from: 575_000, to: 605_000 },
  { grade: 34, standardMonthly: 620_000, from: 605_000, to: 635_000 },
  { grade: 35, standardMonthly: 650_000, from: 635_000, to: 665_000 },
  { grade: 36, standardMonthly: 680_000, from: 665_000, to: 695_000 },
  { grade: 37, standardMonthly: 710_000, from: 695_000, to: 730_000 },
  { grade: 38, standardMonthly: 750_000, from: 730_000, to: 770_000 },
  { grade: 39, standardMonthly: 790_000, from: 770_000, to: 810_000 },
  { grade: 40, standardMonthly: 830_000, from: 810_000, to: 855_000 },
  { grade: 41, standardMonthly: 880_000, from: 855_000, to: 905_000 },
  { grade: 42, standardMonthly: 930_000, from: 905_000, to: 955_000 },
  { grade: 43, standardMonthly: 980_000, from: 955_000, to: 1_005_000 },
  { grade: 44, standardMonthly: 1_030_000, from: 1_005_000, to: 1_055_000 },
  { grade: 45, standardMonthly: 1_090_000, from: 1_055_000, to: 1_115_000 },
  { grade: 46, standardMonthly: 1_150_000, from: 1_115_000, to: 1_175_000 },
  { grade: 47, standardMonthly: 1_210_000, from: 1_175_000, to: 1_235_000 },
  { grade: 48, standardMonthly: 1_270_000, from: 1_235_000, to: 1_295_000 },
  { grade: 49, standardMonthly: 1_330_000, from: 1_295_000, to: 1_355_000 },
  { grade: 50, standardMonthly: 1_390_000, from: 1_355_000, to: Number.POSITIVE_INFINITY },
];

/**
 * 厚生年金の標準報酬月額表（2026 年度・全 32 等級）。
 *
 * **健康保険とは等級の刻みが違う**。厚生年金は 65 万円で頭打ちになるため、
 * それ以上いくら稼いでも保険料は増えない（将来の年金額も増えない）。
 */
export const PENSION_GRADES: readonly Grade[] = [
  { grade: 1, standardMonthly: 88_000, from: 0, to: 93_000 },
  { grade: 2, standardMonthly: 98_000, from: 93_000, to: 101_000 },
  { grade: 3, standardMonthly: 104_000, from: 101_000, to: 107_000 },
  { grade: 4, standardMonthly: 110_000, from: 107_000, to: 114_000 },
  { grade: 5, standardMonthly: 118_000, from: 114_000, to: 122_000 },
  { grade: 6, standardMonthly: 126_000, from: 122_000, to: 130_000 },
  { grade: 7, standardMonthly: 134_000, from: 130_000, to: 138_000 },
  { grade: 8, standardMonthly: 142_000, from: 138_000, to: 146_000 },
  { grade: 9, standardMonthly: 150_000, from: 146_000, to: 155_000 },
  { grade: 10, standardMonthly: 160_000, from: 155_000, to: 165_000 },
  { grade: 11, standardMonthly: 170_000, from: 165_000, to: 175_000 },
  { grade: 12, standardMonthly: 180_000, from: 175_000, to: 185_000 },
  { grade: 13, standardMonthly: 190_000, from: 185_000, to: 195_000 },
  { grade: 14, standardMonthly: 200_000, from: 195_000, to: 210_000 },
  { grade: 15, standardMonthly: 220_000, from: 210_000, to: 230_000 },
  { grade: 16, standardMonthly: 240_000, from: 230_000, to: 250_000 },
  { grade: 17, standardMonthly: 260_000, from: 250_000, to: 270_000 },
  { grade: 18, standardMonthly: 280_000, from: 270_000, to: 290_000 },
  { grade: 19, standardMonthly: 300_000, from: 290_000, to: 310_000 },
  { grade: 20, standardMonthly: 320_000, from: 310_000, to: 330_000 },
  { grade: 21, standardMonthly: 340_000, from: 330_000, to: 350_000 },
  { grade: 22, standardMonthly: 360_000, from: 350_000, to: 370_000 },
  { grade: 23, standardMonthly: 380_000, from: 370_000, to: 395_000 },
  { grade: 24, standardMonthly: 410_000, from: 395_000, to: 425_000 },
  { grade: 25, standardMonthly: 440_000, from: 425_000, to: 455_000 },
  { grade: 26, standardMonthly: 470_000, from: 455_000, to: 485_000 },
  { grade: 27, standardMonthly: 500_000, from: 485_000, to: 515_000 },
  { grade: 28, standardMonthly: 530_000, from: 515_000, to: 545_000 },
  { grade: 29, standardMonthly: 560_000, from: 545_000, to: 575_000 },
  { grade: 30, standardMonthly: 590_000, from: 575_000, to: 605_000 },
  { grade: 31, standardMonthly: 620_000, from: 605_000, to: 635_000 },
  { grade: 32, standardMonthly: 650_000, from: 635_000, to: Number.POSITIVE_INFINITY },
];

/** 保険料率（すべて年度・都道府県で変わるため引数で渡す）。 */
export interface InsuranceRates {
  /**
   * 健康保険料率（全体。労使合計）。
   * 協会けんぽは**都道府県ごとに違う**（2026 年度の東京は約 9.98%）。
   */
  health: number;
  /**
   * 介護保険料率（全体）。**40 歳以上のみ**上乗せされる。
   */
  longTermCare: number;
  /**
   * 厚生年金保険料率（全体）。2017 年 9 月以降は 18.3% で固定。
   */
  pension: number;
  /**
   * 雇用保険の**本人負担分**の料率。業種で違う（一般の事業は 0.55% など）。
   * **等級を使わず額面に直接掛ける**ところが他と違う。
   */
  employmentInsurance: number;
}

/** 2026 年度・東京の目安（**必ず最新の料率を確認して渡すこと**）。 */
export const REFERENCE_RATES_2026_TOKYO: InsuranceRates = {
  health: 0.0998,
  longTermCare: 0.0159,
  pension: 0.183,
  employmentInsurance: 0.0055,
};

/** 1 人分の計算結果（本人が天引きされる額）。 */
export interface InsuranceDeduction {
  /** 健康保険料（本人負担）。 */
  health: number;
  /** 介護保険料（本人負担。40 歳未満は 0）。 */
  longTermCare: number;
  /** 厚生年金保険料（本人負担）。 */
  pension: number;
  /** 雇用保険料（本人負担）。 */
  employmentInsurance: number;
  /** 天引き合計。 */
  total: number;
  /** 使った標準報酬月額（健康保険）。 */
  healthStandardMonthly: number;
  /** 使った標準報酬月額（厚生年金）。 */
  pensionStandardMonthly: number;
}

/**
 * 報酬月額から等級を引く。
 *
 * **境目は「以上・未満」**。上限を超えたら最上位の等級で頭打ちにする
 * （厚生年金は 65 万円以上がすべて 32 等級）。
 *
 * @param monthlyPay 報酬月額（円。通勤手当などを含む総支給額）
 * @param grades 等級表（{@link HEALTH_INSURANCE_GRADES} など）
 * @returns 該当する等級
 *
 * @example
 * ```ts
 * findGrade(305_000, PENSION_GRADES);  // → { grade: 19, standardMonthly: 300_000, … }
 * ```
 */
export function findGrade(monthlyPay: number, grades: readonly Grade[]): Grade {
  const pay = Math.max(0, monthlyPay);
  const hit = grades.find((g) => pay >= g.from && pay < g.to);
  // 上限を超えた場合は最上位（配列は昇順である前提）
  return hit ?? grades[grades.length - 1]!;
}

/**
 * 保険料の端数を処理する。
 *
 * **通貨処理法の定め**により、50 銭以下は切り捨て、50 銭超は切り上げる
 * （四捨五入ではない。ちょうど 50 銭のとき結果が変わる）。
 *
 * @param amount 端数を含む金額
 * @returns 円単位の金額
 */
export function roundPremium(amount: number): number {
  const floor = Math.floor(amount);
  const frac = amount - floor;
  return frac > 0.5 ? floor + 1 : floor;
}

/**
 * 介護保険の対象かを判定する。
 *
 * **40 歳の誕生日の前日が属する月から** 64 歳まで。
 * 「誕生日の前日」なので、**1 日生まれの人は前月から**対象になる
 * （4/1 生まれなら 3/31 が 40 歳到達日 → 3 月分から徴収）。
 *
 * @param birthDate 生年月日（YYYY-MM-DD）
 * @param targetMonth 対象月（YYYY-MM）
 * @returns 対象なら true
 *
 * @example
 * ```ts
 * isLongTermCareTarget("1986-04-01", "2026-03");  // → true（前日 3/31 に 40 歳）
 * isLongTermCareTarget("1986-04-02", "2026-03");  // → false（4 月から）
 * ```
 */
export function isLongTermCareTarget(birthDate: string, targetMonth: string): boolean {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return false;

  // 40 歳到達日 = 40 歳の誕生日の前日
  const reach40 = new Date(birth);
  reach40.setUTCFullYear(reach40.getUTCFullYear() + 40);
  reach40.setUTCDate(reach40.getUTCDate() - 1);

  // 65 歳到達日（この月から対象外。以降は年金から天引きされる）
  const reach65 = new Date(birth);
  reach65.setUTCFullYear(reach65.getUTCFullYear() + 65);
  reach65.setUTCDate(reach65.getUTCDate() - 1);

  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return monthKey(reach40) <= targetMonth && targetMonth < monthKey(reach65);
}

/**
 * 社会保険料（本人負担分）を計算する。
 *
 * **健康保険・厚生年金は労使折半**なので、全体の料率を掛けてから半分にする。
 * 雇用保険だけは本人負担分の料率を直接渡す仕組みになっている（会社負担の方が大きく、
 * 折半ではないため）。
 *
 * @param input.monthlyPay 報酬月額（円。総支給額）
 * @param input.birthDate 生年月日（YYYY-MM-DD。介護保険の判定に使う）
 * @param input.targetMonth 対象月（YYYY-MM）
 * @param rates 保険料率（{@link REFERENCE_RATES_2026_TOKYO} は目安。**最新を渡すこと**）
 * @returns 天引きする額の内訳
 *
 * @example
 * ```ts
 * const d = calcInsuranceDeduction(
 *   { monthlyPay: 305_000, birthDate: "1990-05-15", targetMonth: "2026-08" },
 *   REFERENCE_RATES_2026_TOKYO,
 * );
 * // d.total が給与から天引きする社会保険料
 * ```
 */
export function calcInsuranceDeduction(
  input: { monthlyPay: number; birthDate: string; targetMonth: string },
  rates: InsuranceRates,
): InsuranceDeduction {
  const healthGrade = findGrade(input.monthlyPay, HEALTH_INSURANCE_GRADES);
  const pensionGrade = findGrade(input.monthlyPay, PENSION_GRADES);

  // **労使折半**なので 2 で割る
  const health = roundPremium((healthGrade.standardMonthly * rates.health) / 2);
  const pension = roundPremium((pensionGrade.standardMonthly * rates.pension) / 2);

  const careTarget = isLongTermCareTarget(input.birthDate, input.targetMonth);
  const longTermCare = careTarget
    ? roundPremium((healthGrade.standardMonthly * rates.longTermCare) / 2)
    : 0;

  // **雇用保険だけ額面に直接掛ける**（等級を使わない）
  const employmentInsurance = roundPremium(input.monthlyPay * rates.employmentInsurance);

  return {
    health,
    longTermCare,
    pension,
    employmentInsurance,
    total: health + longTermCare + pension + employmentInsurance,
    healthStandardMonthly: healthGrade.standardMonthly,
    pensionStandardMonthly: pensionGrade.standardMonthly,
  };
}

/**
 * 会社負担分を含めた総額を計算する。
 *
 * **人を 1 人雇うのにいくらかかるか**を出すのに使う。
 * 額面の他に、会社は社会保険料の半分を負担している（額面のおよそ 15% 前後）。
 *
 * @param input {@link calcInsuranceDeduction} と同じ
 * @param rates 保険料率
 * @param employerEmploymentRate 雇用保険の**会社負担分**の料率（一般の事業で 0.9% など）
 * @returns 本人負担・会社負担・合計
 */
export function calcTotalLaborCost(
  input: { monthlyPay: number; birthDate: string; targetMonth: string },
  rates: InsuranceRates,
  employerEmploymentRate: number,
): { employee: number; employer: number; total: number } {
  const employee = calcInsuranceDeduction(input, rates);

  const healthGrade = findGrade(input.monthlyPay, HEALTH_INSURANCE_GRADES);
  const pensionGrade = findGrade(input.monthlyPay, PENSION_GRADES);
  const careTarget = isLongTermCareTarget(input.birthDate, input.targetMonth);

  // 会社負担も同じ計算（折半なので本人と同額）
  const employerHealth = roundPremium((healthGrade.standardMonthly * rates.health) / 2);
  const employerPension = roundPremium((pensionGrade.standardMonthly * rates.pension) / 2);
  const employerCare = careTarget ? roundPremium((healthGrade.standardMonthly * rates.longTermCare) / 2) : 0;
  const employerEmployment = roundPremium(input.monthlyPay * employerEmploymentRate);

  const employer = employerHealth + employerPension + employerCare + employerEmployment;
  return { employee: employee.total, employer, total: employee.total + employer };
}
