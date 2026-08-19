/**
 * 固定資産の減価償却計算。
 *
 * - 定額法（straight_line）: 取得価額 ÷ 耐用年数 を毎期償却し、最終年度は残存簿価1円（備忘価額）まで。
 * - 定率法（declining_balance）: 期首簿価 × 償却率（既定は 200%定率法 = 2 ÷ 耐用年数）。
 *   各期、残存年数での均等額（定額）を下回ったら定額へ切り替え、耐用年数内に1円まで償却しきる。
 *
 * すべて円未満切り捨て。取得年度も1年分（暦年ベース）として計算する（月割は {@link monthlyAmount}）。
 * @packageDocumentation
 */

/** 償却方法。 */
export type DepreciationMethod = "straight_line" | "declining_balance";

/** 償却対象の資産。 */
export interface DepreciableAsset {
  /** 取得価額（円）。 */
  cost: number;
  /** 耐用年数（年）。 */
  usefulLifeYears: number;
  /** 償却方法。 */
  method: DepreciationMethod;
  /** 定率法の償却率（未指定なら 2 ÷ 耐用年数）。 */
  rate?: number;
}

/** 償却スケジュールの1年分。 */
export interface ScheduleRow {
  /** 年度（西暦）。 */
  year: number;
  /** その年の償却額。 */
  depreciation: number;
  /** 償却累計額。 */
  accumulated: number;
  /** 期末簿価。 */
  bookValue: number;
}

/** 備忘価額（残存簿価）。 */
export const MEMORANDUM_VALUE = 1;

/**
 * 定額法の償却率を返す(1 ÷ 耐用年数)。
 *
 * @param usefulLifeYears 耐用年数
 * @returns 償却率
 */
export function straightLineRate(usefulLifeYears: number): number {
  return usefulLifeYears > 0 ? 1 / usefulLifeYears : 0;
}

/**
 * 定率法の償却率を返す(**200% 定率法** = 2 ÷ 耐用年数)。
 *
 * 平成 24 年 4 月以降に取得した資産に適用される率。
 * **取得時期で率が変わる**(それ以前は 250% 定率法)ので、古い資産には使えない。
 *
 * @param usefulLifeYears 耐用年数
 * @returns 償却率
 */
export function decliningBalanceRate(usefulLifeYears: number): number {
  return usefulLifeYears > 0 ? 2 / usefulLifeYears : 0;
}

function isLastMeaningfulYear(yearIndex: number, life: number): boolean {
  return yearIndex >= life - 1;
}

/**
 * 定額法の償却スケジュールを作る。
 *
 * **最終年度は 1 円を残す**(備忘価額)。0 にすると帳簿から消えてしまい、
 * まだ使っている資産を管理できなくなる。
 *
 * @param cost 取得価額
 * @param usefulLifeYears 耐用年数
 * @param startYear 初年度（**年の途中で取得しても月割りしません**）
 * @returns 年次の償却額と期末簿価
 */
export function straightLineSchedule(cost: number, usefulLifeYears: number, startYear: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (cost <= MEMORANDUM_VALUE || usefulLifeYears <= 0) return rows;
  const annual = Math.floor(cost / usefulLifeYears);
  let book = cost;
  let accumulated = 0;
  for (let i = 0; i < usefulLifeYears; i++) {
    let dep = annual;
    if (isLastMeaningfulYear(i, usefulLifeYears)) dep = book - MEMORANDUM_VALUE;
    if (dep > book - MEMORANDUM_VALUE) dep = book - MEMORANDUM_VALUE;
    if (dep < 0) dep = 0;
    book -= dep;
    accumulated += dep;
    rows.push({ year: startYear + i, depreciation: dep, accumulated, bookValue: book });
  }
  return rows;
}

/**
 * 定率法の償却スケジュールを作る。
 *
 * **途中で定額法に切り替わる**のが要点。定率法は年々償却額が減るため、
 * そのままでは耐用年数内に償却しきれない。最終年度は 1 円を残す。
 *
 * **切り替えの判定は法令の表と同じではない。** 税法は「償却保証額(取得価額 × 保証率)を
 * 下回った年から、改定取得価額 × 改定償却率で均等償却」と定めており、保証率・改定償却率は
 * 耐用年数ごとの表で決まる。ここでは表を持たず、**残存年数での均等額と比べて大きい方**を
 * 採る近似で切り替えている。結果はごく近い(耐用年数 5 年・100 万円で切替年に 1 円差)が、
 * **申告書の数字と一致させる必要があるなら、耐用年数省令の表を実装すること**。
 *
 * @param cost 取得価額
 * @param usefulLifeYears 耐用年数
 * @param startYear 初年度（**年の途中で取得しても月割りしません**）
 * @param rate 償却率（省略時は耐用年数から求める）
 * @returns 年次の償却額と期末簿価
 */
export function decliningBalanceSchedule(cost: number, usefulLifeYears: number, startYear: number, rate?: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (cost <= MEMORANDUM_VALUE || usefulLifeYears <= 0) return rows;
  const r = rate ?? decliningBalanceRate(usefulLifeYears);
  let book = cost;
  let accumulated = 0;
  for (let i = 0; i < usefulLifeYears; i++) {
    const remainingYears = usefulLifeYears - i;
    const dbAmount = Math.floor(book * r);
    const evenAmount = Math.floor((book - MEMORANDUM_VALUE) / remainingYears);
    let dep = Math.max(dbAmount, evenAmount);
    if (isLastMeaningfulYear(i, usefulLifeYears) || dep > book - MEMORANDUM_VALUE) dep = book - MEMORANDUM_VALUE;
    if (dep < 0) dep = 0;
    book -= dep;
    accumulated += dep;
    rows.push({ year: startYear + i, depreciation: dep, accumulated, bookValue: book });
  }
  return rows;
}

/**
 * 償却方法に応じてスケジュールを作る。
 *
 * @param asset 対象資産(取得価額・耐用年数・償却方法 `straight_line` / `declining_balance`)
 * @param startYear 償却を開始する年
 * @returns 年次の償却額と期末簿価
 */
export function depreciationSchedule(asset: DepreciableAsset, startYear: number): ScheduleRow[] {
  return asset.method === "declining_balance"
    ? decliningBalanceSchedule(asset.cost, asset.usefulLifeYears, startYear, asset.rate)
    : straightLineSchedule(asset.cost, asset.usefulLifeYears, startYear);
}

/**
 * 指定年度の期末簿価を返す。
 *
 * @param schedule 償却スケジュール
 * @param year **西暦**(スケジュールの `year` と同じ。1 始まりの連番ではない)
 * @param cost 取得価額
 * @returns その年度末の簿価。**取得前は取得価額、償却後は最終簿価**
 */
export function bookValueAt(schedule: ScheduleRow[], year: number, cost: number): number {
  if (schedule.length === 0) return cost;
  if (year < schedule[0]!.year) return cost;
  let book = cost;
  for (const row of schedule) {
    if (row.year > year) break;
    book = row.bookValue;
  }
  return book;
}

/**
 * 指定年度の償却額を返す。
 *
 * @param schedule 償却スケジュール
 * @param year **西暦**(スケジュールの `year` と同じ。1 始まりの連番ではない)
 * @returns その年度の償却額。**該当年度が無ければ 0**(例外にしない)
 */
export function depreciationInYear(schedule: ScheduleRow[], year: number): number {
  return schedule.find((r) => r.year === year)?.depreciation ?? 0;
}

/**
 * 年間償却額を月割りする(円未満切り捨て)。
 *
 * **期中に取得した資産は月割りする**(4 月取得で 3 月決算なら 12 か月、
 * 10 月取得なら 6 か月)。取得した年から丸 1 年ぶん償却すると過大計上になる。
 *
 * @param annual 年間の償却額
 * @param months 事業供用月数(既定 12 = 1 か月分だけ欲しいときは 1 を渡す)
 * @returns 月割りした償却額(**円未満切り捨て**)
 *
 * @example
 * ```ts
 * monthlyAmount(200_000);      // 16,666(1 か月分)
 * monthlyAmount(200_000, 6);   // 100,000(6 か月分)
 * ```
 */
export function monthlyAmount(annual: number, months = 1): number {
  return Math.floor((annual / 12) * months);
}

export * from "./property-tax";
