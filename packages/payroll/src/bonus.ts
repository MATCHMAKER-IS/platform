/**
 * 賞与（ボーナス）の社会保険料と源泉徴収。
 *
 * **月給とは計算方法が違う**。同じつもりで実装すると必ず合わない。
 *
 * 【月給との違い】
 *
 * | | 月給 | 賞与 |
 * |---|---|---|
 * | 保険料の対象 | 標準報酬月額（**等級表で丸める**） | 標準賞与額（**1,000 円未満を切り捨て**） |
 * | 保険料の上限 | 等級表の最上位 | **健保は年 573 万・厚年は月 150 万** |
 * | 所得税 | 月額表を引く | **前月の給与から税率を決める**（算出率の表） |
 *
 * 特に上限の考え方が違う。健康保険は**年度の累計**で 573 万円まで（4 月〜翌 3 月）、
 * 厚生年金は**1 回ごと**に 150 万円まで。年 3 回の賞与なら厚年は最大 450 万円分かかる。
 *
 * 【累計を持ち回る必要がある】
 * 健康保険の上限は年度累計なので、**その年度に既に支給した賞与の合計**を渡す必要がある。
 * これを忘れると、上限を超えても保険料を取り続けることになる。
 *
 * @packageDocumentation
 */
import type { InsuranceRates } from "./insurance";

/**
 * 保険料の端数を処理する（{@link roundPremium} と同じ規則）。
 *
 * **通貨処理法の定め**により、50 銭以下は切り捨て、50 銭超は切り上げる（四捨五入ではない）。
 * `insurance.ts` にも同じものがあるが、**型だけの依存に留める**ため再掲している
 * （値を import すると、賞与を使うだけで月給の等級表まで読み込まれる）。
 */
function roundBonusPremium(amount: number): number {
  const floor = Math.floor(amount);
  return amount - floor > 0.5 ? floor + 1 : floor;
}

/** 標準賞与額の上限。 */
export const BONUS_CAPS = {
  /** 健康保険・介護保険: **年度（4 月〜翌 3 月）の累計**で 573 万円。 */
  healthYearly: 5_730_000,
  /** 厚生年金: **1 回の支給ごと**に 150 万円。 */
  pensionPerPayment: 1_500_000,
} as const;

/**
 * 標準賞与額を求める（1,000 円未満を切り捨て）。
 *
 * **月給の等級表とは違う**。賞与は等級を使わず、単に 1,000 円未満を落とす。
 *
 * @param bonusAmount 賞与の総支給額（円）
 * @returns 標準賞与額（円）
 *
 * @example
 * ```ts
 * standardBonus(456_789);  // → 456_000
 * ```
 */
export function standardBonus(bonusAmount: number): number {
  return Math.floor(Math.max(0, bonusAmount) / 1000) * 1000;
}

/** 賞与の社会保険料（本人負担分）。 */
export interface BonusInsuranceDeduction {
  /** 健康保険料。 */
  health: number;
  /** 介護保険料（40 歳未満は 0）。 */
  longTermCare: number;
  /** 厚生年金保険料。 */
  pension: number;
  /** 雇用保険料。 */
  employmentInsurance: number;
  /** 合計。 */
  total: number;
  /** 実際に保険料の対象になった額（健康保険。上限で切られることがある）。 */
  healthTargetAmount: number;
  /** 同（厚生年金）。 */
  pensionTargetAmount: number;
  /** 上限で切られたか。**給与明細で説明が要る**ので返す。 */
  cappedByLimit: boolean;
}

/**
 * 賞与の社会保険料（本人負担分）を計算する。
 *
 * **健康保険の上限は年度累計**なので、`yearlyBonusSoFar` にその年度（4 月〜翌 3 月）に
 * 既に支給した賞与の標準賞与額の合計を渡す。渡し忘れると、上限を超えても
 * 保険料を取り続けることになる。
 *
 * @param input.bonusAmount 賞与の総支給額（円）
 * @param input.yearlyBonusSoFar その年度に既に支給した標準賞与額の累計（円。今回を含まない）
 * @param input.isLongTermCareTarget 介護保険の対象か（40〜64 歳。{@link isLongTermCareTarget} で判定）
 * @param rates 保険料率（月給と同じものを使う）
 * @returns 天引きする額の内訳
 *
 * @example
 * ```ts
 * const d = calcBonusInsurance(
 *   { bonusAmount: 800_000, yearlyBonusSoFar: 0, isLongTermCareTarget: false },
 *   REFERENCE_RATES_2026_TOKYO,
 * );
 * ```
 */
export function calcBonusInsurance(
  input: { bonusAmount: number; yearlyBonusSoFar: number; isLongTermCareTarget: boolean },
  rates: InsuranceRates,
): BonusInsuranceDeduction {
  const standard = standardBonus(input.bonusAmount);

  // **健康保険は年度累計で 573 万円まで。** 既に使った分を差し引いた残りが対象
  const healthRemaining = Math.max(0, BONUS_CAPS.healthYearly - Math.max(0, input.yearlyBonusSoFar));
  const healthTarget = Math.min(standard, healthRemaining);

  // **厚生年金は 1 回ごとに 150 万円まで**（累計ではない）
  const pensionTarget = Math.min(standard, BONUS_CAPS.pensionPerPayment);

  const health = roundBonusPremium((healthTarget * rates.health) / 2);
  const pension = roundBonusPremium((pensionTarget * rates.pension) / 2);
  const longTermCare = input.isLongTermCareTarget
    ? roundBonusPremium((healthTarget * rates.longTermCare) / 2)
    : 0;

  // **雇用保険は上限が無く、賞与の額面に直接**掛ける
  const employmentInsurance = roundBonusPremium(input.bonusAmount * rates.employmentInsurance);

  return {
    health,
    longTermCare,
    pension,
    employmentInsurance,
    total: health + longTermCare + pension + employmentInsurance,
    healthTargetAmount: healthTarget,
    pensionTargetAmount: pensionTarget,
    cappedByLimit: healthTarget < standard || pensionTarget < standard,
  };
}

/**
 * 賞与の源泉徴収の算出率表・1 行。
 *
 * 国税庁の「賞与に対する源泉徴収税額の算出率の表」の 1 行に対応する。
 * **前月の給与（社会保険料控除後）**で行を決め、その行の税率を賞与に掛ける。
 */
export interface BonusRateRow {
  /** 扶養親族等の数（0〜7）。 */
  dependents: number;
  /** 前月の社会保険料等控除後の給与（円。以上）。 */
  from: number;
  /** 同（円。未満。最終行は Infinity）。 */
  to: number;
  /** 賞与に掛ける税率（例 0.02042）。 */
  rate: number;
}

/** 賞与の算出率表。 */
export interface BonusRateTable {
  /** 表の年度（例 "2026"）。 */
  year: string;
  rows: readonly BonusRateRow[];
}

/**
 * 賞与の源泉徴収税額を計算する。
 *
 * **月額表ではなく「算出率の表」を引く**。しかも引くのは賞与の額ではなく
 * **前月の給与**（社会保険料控除後）。ここを間違えると税額が大きくずれる。
 *
 * @param table 算出率の表（アプリが年度に応じて用意する）
 * @param input.bonusAfterInsurance 社会保険料を引いた後の賞与額（円）
 * @param input.previousMonthPay **前月**の社会保険料等控除後の給与（円）
 * @param input.dependents 扶養親族等の数（0〜7）
 * @returns 源泉徴収税額（円。1 円未満切り捨て）
 * @throws 表に該当行が無い場合
 *
 * @example
 * ```ts
 * const tax = bonusWithholdingTax(table, {
 *   bonusAfterInsurance: 700_000,
 *   previousMonthPay: 255_930,   // **前月の給与**で税率が決まる
 *   dependents: 1,
 * });
 * ```
 */
export function bonusWithholdingTax(
  table: BonusRateTable,
  input: { bonusAfterInsurance: number; previousMonthPay: number; dependents: number },
): number {
  const col = Math.min(7, Math.max(0, Math.floor(input.dependents)));
  const prev = Math.max(0, Math.floor(input.previousMonthPay));

  const row = table.rows.find((r) => r.dependents === col && prev >= r.from && prev < r.to);
  if (row === undefined) {
    throw new Error(
      `賞与の算出率表(${table.year})に 扶養 ${col} 人・前月給与 ${prev.toLocaleString()} 円 の行がありません`,
    );
  }
  return Math.floor(Math.max(0, input.bonusAfterInsurance) * row.rate);
}

/** 賞与の支給内訳。 */
export interface BonusPayment {
  /** 総支給額。 */
  grossAmount: number;
  /** 社会保険料の合計。 */
  socialInsurance: number;
  /** 源泉所得税。 */
  incomeTax: number;
  /** 天引き合計。 */
  totalDeduction: number;
  /** 差引支給額（手取り）。 */
  netAmount: number;
  /** 上限で保険料が切られたか。 */
  cappedByLimit: boolean;
}

/**
 * 賞与の総支給から手取りまでを組み立てる。
 *
 * **順序が決まっている**:
 *   賞与 − 社会保険料 = 課税対象 → 前月の給与で税率を引く → 手取り
 *
 * **住民税は賞与から引かない**（月給から年 12 回で引くため）。ここが月給と違う。
 *
 * @param input.bonusAmount 賞与の総支給額
 * @param input.yearlyBonusSoFar その年度に既に支給した標準賞与額の累計
 * @param input.isLongTermCareTarget 介護保険の対象か
 * @param input.previousMonthPay 前月の社会保険料等控除後の給与
 * @param input.dependents 扶養親族等の数
 * @param rates 保険料率
 * @param rateTable 賞与の算出率表
 * @returns 内訳と手取り
 */
export function buildBonusPayment(
  input: {
    bonusAmount: number;
    yearlyBonusSoFar: number;
    isLongTermCareTarget: boolean;
    previousMonthPay: number;
    dependents: number;
  },
  rates: InsuranceRates,
  rateTable: BonusRateTable,
): BonusPayment {
  const ins = calcBonusInsurance(input, rates);
  const afterInsurance = input.bonusAmount - ins.total;
  const incomeTax = bonusWithholdingTax(rateTable, {
    bonusAfterInsurance: afterInsurance,
    previousMonthPay: input.previousMonthPay,
    dependents: input.dependents,
  });
  const totalDeduction = ins.total + incomeTax;
  return {
    grossAmount: input.bonusAmount,
    socialInsurance: ins.total,
    incomeTax,
    totalDeduction,
    netAmount: input.bonusAmount - totalDeduction,
    cappedByLimit: ins.cappedByLimit,
  };
}
