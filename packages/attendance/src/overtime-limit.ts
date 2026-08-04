/**
 * 時間外労働の上限規制（労働基準法 第36条・いわゆる 36 協定）。
 *
 * **2019 年 4 月（中小企業は 2020 年 4 月）から罰則付き**になった。
 * 超えると 6 か月以下の懲役または 30 万円以下の罰金で、**会社が処罰される**。
 *
 * 【上限（36 協定を結んだ場合）】
 *   - 原則: **月 45 時間・年 360 時間**
 *   - 特別条項があっても超えられない線:
 *       * **年 720 時間**
 *       * **単月 100 時間未満**（休日労働を含む）
 *       * **2〜6 か月平均が 80 時間以内**（休日労働を含む）
 *       * 月 45 時間を超えてよいのは**年 6 回まで**
 *
 * 【気をつける点】
 *   - **単月 100 時間は「未満」**。ちょうど 100 時間は違反
 *   - **平均 80 時間は「以内」**。ちょうど 80 時間は適法
 *   - 100 時間・80 時間の判定には**休日労働も含める**（月 45 時間の方は含めない）
 *   - 2〜6 か月平均は、**どの区間を取っても**超えてはいけない
 *
 * 気づいたときには既に違反、という事故が起きやすい。**月次で見張る**ために使う。
 *
 * @packageDocumentation
 */

/** 1 か月分の時間外労働。 */
export interface MonthlyOvertime {
  /** 対象月（YYYY-MM）。 */
  month: string;
  /** 時間外労働（分。法定労働時間を超えた分）。 */
  overtimeMinutes: number;
  /** 法定休日労働（分）。**100 時間・80 時間の判定にだけ含める**。 */
  holidayMinutes: number;
}

/** 上限の設定（特別条項の有無で変わる）。 */
export interface OvertimeLimits {
  /** 原則の月上限（分。既定 45 時間）。 */
  monthlyMinutes: number;
  /** 年間上限（分。既定 360 時間。特別条項ありなら 720 時間）。 */
  yearlyMinutes: number;
  /** 単月の絶対上限（分。既定 100 時間。**未満**であること）。 */
  singleMonthCapMinutes: number;
  /** 複数月平均の上限（分。既定 80 時間。**以内**であること）。 */
  averageCapMinutes: number;
  /** 月上限を超えてよい回数（既定 6 回）。 */
  exceedCountLimit: number;
}

/** 原則の上限（特別条項なし）。 */
export const DEFAULT_LIMITS: OvertimeLimits = {
  monthlyMinutes: 45 * 60,
  yearlyMinutes: 360 * 60,
  singleMonthCapMinutes: 100 * 60,
  averageCapMinutes: 80 * 60,
  exceedCountLimit: 6,
};

/** 特別条項ありの上限（年 720 時間まで）。 */
export const SPECIAL_CLAUSE_LIMITS: OvertimeLimits = {
  ...DEFAULT_LIMITS,
  yearlyMinutes: 720 * 60,
};

/** 違反・注意の 1 件。 */
export interface OvertimeViolation {
  /** どの規制か。 */
  kind: "single-month" | "average" | "yearly" | "monthly" | "exceed-count";
  /** 深刻度。`violation` は**既に法令違反**、`warning` はこのままだと違反。 */
  severity: "violation" | "warning";
  /** 対象月（複数月にまたがる場合は末尾の月）。 */
  month: string;
  /** 何が起きているか。 */
  message: string;
  /** 実測値（分）。 */
  actualMinutes: number;
  /** 上限（分）。 */
  limitMinutes: number;
}

/** 分を「◯時間◯分」にする（メッセージ用）。 */
function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

/**
 * 時間外労働が上限を超えていないか判定する。
 *
 * **月次で回す**ことを想定している。気づいたときには既に違反、という事故を防ぐため、
 * 上限に近づいた時点で `warning` を返す（既定は上限の 90%）。
 *
 * @param months 対象期間の月次データ（**月の昇順**。年度単位で渡すのが普通）
 * @param limits 上限の設定（{@link DEFAULT_LIMITS} / {@link SPECIAL_CLAUSE_LIMITS}）
 * @param warningRatio 警告を出す割合（既定 0.9 = 上限の 90%）
 * @returns 違反・注意の一覧（深刻な順）
 *
 * @example
 * ```ts
 * const issues = checkOvertimeLimits(months, SPECIAL_CLAUSE_LIMITS);
 * const urgent = issues.filter((i) => i.severity === "violation");
 * ```
 */
export function checkOvertimeLimits(
  months: readonly MonthlyOvertime[],
  limits: OvertimeLimits = DEFAULT_LIMITS,
  warningRatio = 0.9,
): OvertimeViolation[] {
  const out: OvertimeViolation[] = [];
  const sorted = [...months].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  // ── 単月 100 時間未満（休日労働を含む）──
  for (const m of sorted) {
    const total = m.overtimeMinutes + m.holidayMinutes;
    if (total >= limits.singleMonthCapMinutes) {
      out.push({
        kind: "single-month", severity: "violation", month: m.month,
        // **「未満」なのでちょうど 100 時間も違反**。ここを「以下」と実装する誤りが多い
        message: `単月の上限（${fmt(limits.singleMonthCapMinutes)}未満）を超えています。休日労働を含めて ${fmt(total)}`,
        actualMinutes: total, limitMinutes: limits.singleMonthCapMinutes,
      });
    } else if (total >= limits.singleMonthCapMinutes * warningRatio) {
      out.push({
        kind: "single-month", severity: "warning", month: m.month,
        message: `単月の上限に近づいています（${fmt(total)} / ${fmt(limits.singleMonthCapMinutes)}未満）`,
        actualMinutes: total, limitMinutes: limits.singleMonthCapMinutes,
      });
    }
  }

  // ── 2〜6 か月平均 80 時間以内（休日労働を含む）──
  // **どの区間を取っても**超えてはいけないので、すべての窓を見る
  for (let span = 2; span <= 6; span += 1) {
    for (let i = 0; i + span <= sorted.length; i += 1) {
      const window = sorted.slice(i, i + span);
      const sum = window.reduce((s, m) => s + m.overtimeMinutes + m.holidayMinutes, 0);
      const avg = sum / span;
      const last = window[window.length - 1]!;
      if (avg > limits.averageCapMinutes) {
        out.push({
          kind: "average", severity: "violation", month: last.month,
          // **「以内」なのでちょうど 80 時間は適法**。単月とは扱いが違う
          message: `${span}か月平均が上限（${fmt(limits.averageCapMinutes)}以内）を超えています。${window[0]!.month}〜${last.month} の平均 ${fmt(Math.round(avg))}`,
          actualMinutes: Math.round(avg), limitMinutes: limits.averageCapMinutes,
        });
      }
    }
  }

  // ── 年 360（720）時間 ──
  // 年間上限は**時間外労働のみ**（休日労働は含めない）
  const yearTotal = sorted.reduce((s, m) => s + m.overtimeMinutes, 0);
  const lastMonth = sorted[sorted.length - 1]?.month ?? "";
  if (yearTotal > limits.yearlyMinutes) {
    out.push({
      kind: "yearly", severity: "violation", month: lastMonth,
      message: `年間の上限（${fmt(limits.yearlyMinutes)}）を超えています。累計 ${fmt(yearTotal)}`,
      actualMinutes: yearTotal, limitMinutes: limits.yearlyMinutes,
    });
  } else if (yearTotal >= limits.yearlyMinutes * warningRatio) {
    out.push({
      kind: "yearly", severity: "warning", month: lastMonth,
      message: `年間の上限に近づいています（累計 ${fmt(yearTotal)} / ${fmt(limits.yearlyMinutes)}）`,
      actualMinutes: yearTotal, limitMinutes: limits.yearlyMinutes,
    });
  }

  // ── 月 45 時間を超えてよいのは年 6 回まで ──
  // こちらは**時間外労働のみ**で数える（休日労働は含めない）
  const exceeded = sorted.filter((m) => m.overtimeMinutes > limits.monthlyMinutes);
  if (exceeded.length > limits.exceedCountLimit) {
    out.push({
      kind: "exceed-count", severity: "violation", month: exceeded[exceeded.length - 1]!.month,
      message: `月${fmt(limits.monthlyMinutes)}を超えた月が ${exceeded.length} 回あります（年 ${limits.exceedCountLimit} 回まで）`,
      actualMinutes: exceeded.length, limitMinutes: limits.exceedCountLimit,
    });
  } else if (exceeded.length === limits.exceedCountLimit) {
    out.push({
      kind: "exceed-count", severity: "warning", month: exceeded[exceeded.length - 1]!.month,
      message: `月${fmt(limits.monthlyMinutes)}を超えた月が上限の ${limits.exceedCountLimit} 回に達しました（次に超えると違反）`,
      actualMinutes: exceeded.length, limitMinutes: limits.exceedCountLimit,
    });
  }

  // 深刻な順、同じなら月の新しい順
  return out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "violation" ? -1 : 1;
    return a.month < b.month ? 1 : -1;
  });
}

/**
 * 今月あと何時間まで残業できるかを返す。
 *
 * **上限に達してから知らせても遅い**。「あと何時間か」を画面に出せば、
 * 業務の割り振りを変える判断ができる。
 *
 * @param past 今月より前の月次データ（**月の昇順**）
 * @param current 今月の現時点の実績
 * @param limits 上限の設定
 * @returns あと何分残業できるか（**0 なら既に上限**）と、どの規制が効いているか
 *
 * @example
 * ```ts
 * const r = remainingOvertime(pastMonths, thisMonth, SPECIAL_CLAUSE_LIMITS);
 * if (r.remainingMinutes < 10 * 60) alert("残業できるのはあと10時間未満です");
 * ```
 */
export function remainingOvertime(
  past: readonly MonthlyOvertime[],
  current: MonthlyOvertime,
  limits: OvertimeLimits = DEFAULT_LIMITS,
): { remainingMinutes: number; binding: OvertimeViolation["kind"] } {
  const currentTotal = current.overtimeMinutes + current.holidayMinutes;

  // 単月の上限（**未満**なので 1 分手前まで）
  const bySingle = limits.singleMonthCapMinutes - 1 - currentTotal;

  // 年間の上限（時間外のみ）
  const yearSoFar = past.reduce((s, m) => s + m.overtimeMinutes, 0) + current.overtimeMinutes;
  const byYearly = limits.yearlyMinutes - yearSoFar;

  // 直近 5 か月との平均（今月を足して 6 か月平均が 80 時間以内に収まる範囲）
  const recent5 = past.slice(-5);
  const span = recent5.length + 1;
  const sumPast = recent5.reduce((s, m) => s + m.overtimeMinutes + m.holidayMinutes, 0);
  const byAverage = limits.averageCapMinutes * span - sumPast - currentTotal;

  const candidates: { minutes: number; kind: OvertimeViolation["kind"] }[] = [
    { minutes: bySingle, kind: "single-month" },
    { minutes: byYearly, kind: "yearly" },
    { minutes: byAverage, kind: "average" },
  ];
  const tightest = candidates.reduce((a, b) => (b.minutes < a.minutes ? b : a));

  return { remainingMinutes: Math.max(0, tightest.minutes), binding: tightest.kind };
}
