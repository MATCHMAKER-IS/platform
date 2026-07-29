/**
 * 残高の記録を溜めて、古いものを間引く。
 *
 * 1 日に数回取ると、1 年で 1 口座あたり千件を超えます。
 * ただし**過去を振り返るときに日単位は要りません**（月ごとの推移が分かれば足りる）。
 *
 * そこで「**その月が終わったら、月末の 1 件だけ残す**」ようにします。
 *   - 今月ぶんは全部残す（日々の動きを見たい）
 *   - 先月以前は月末の 1 件だけ（推移が分かればよい）
 *
 * **消す前に必ず「残すもの」を決めます。** 「消すもの」を選ぶ形にすると、
 * 条件の書き間違いで全部消えます。
 * @packageDocumentation
 */

/** 1 回の取得で記録する内容。 */
export interface BalanceSnapshot {
  /** 口座 ID。 */
  walletableId: number;
  /** 取得した時刻（ISO 8601）。 */
  takenAt: string;
  /** その時点の残高（円）。 */
  balance: number;
  /** 口座名（後から口座が消えても分かるように残す）。 */
  walletableName?: string;
}

/** 間引きの判断。 */
export interface RetentionPlan {
  /** 残すもの。 */
  keep: BalanceSnapshot[];
  /** 消してよいもの。 */
  remove: BalanceSnapshot[];
  /** 判断の内訳（記録に残す用）。 */
  reason: {
    /** 今月ぶんとして残した数。 */
    currentMonth: number;
    /** 月末として残した数。 */
    monthEnd: number;
    /** 消した数。 */
    removed: number;
  };
}

/** その日が月の最終日か。 */
function isLastDayOfMonth(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCMonth() !== d.getUTCMonth();
}

/** ISO 8601 から日付（YYYY-MM-DD）を取り出す。 */
function dateOf(takenAt: string): string {
  return takenAt.slice(0, 10);
}

/**
 * 残す記録と消す記録を決める。
 *
 * **消さずに返すだけ**です。実際に消すのは呼び出し側の責任にしています
 * （間違いに気づいたときに、実行前で止められるように）。
 *
 * @param snapshots 対象の記録（口座はまたいでよい）
 * @param asOf      基準日（YYYY-MM-DD）。この月が「今月」になる
 * @returns 残すもの・消すもの・その理由
 *
 * @example
 * ```ts
 * const plan = planRetention(all, "2026-07-23");
 * logger.info({ ...plan.reason }, "残高記録の間引き");
 * await store.removeMany(plan.remove.map((s) => s.takenAt));
 * ```
 */
export function planRetention(
  snapshots: readonly BalanceSnapshot[],
  asOf: string,
): RetentionPlan {
  const currentMonth = asOf.slice(0, 7);

  // 「口座 × 日」ごとに最後の 1 件を選ぶ。
  // 1 日に数回取るので、同じ日に複数ある
  const lastOfDay = new Map<string, BalanceSnapshot>();
  for (const s of snapshots) {
    const key = `${s.walletableId}:${dateOf(s.takenAt)}`;
    const cur = lastOfDay.get(key);
    if (!cur || s.takenAt > cur.takenAt) lastOfDay.set(key, s);
  }

  const keep: BalanceSnapshot[] = [];
  const remove: BalanceSnapshot[] = [];
  let kepetCurrent = 0;
  let keptMonthEnd = 0;

  for (const s of snapshots) {
    const date = dateOf(s.takenAt);
    const month = date.slice(0, 7);
    const key = `${s.walletableId}:${date}`;
    const isLastOfDay = lastOfDay.get(key)?.takenAt === s.takenAt;

    // 今月ぶんは全部残す（日々の動きを見たい）
    if (month === currentMonth) {
      keep.push(s);
      kepetCurrent += 1;
      continue;
    }

    // 先月以前は、月末の日の「その日の最後の 1 件」だけ残す
    if (isLastDayOfMonth(date) && isLastOfDay) {
      keep.push(s);
      keptMonthEnd += 1;
      continue;
    }

    remove.push(s);
  }

  return {
    keep,
    remove,
    reason: { currentMonth: kepetCurrent, monthEnd: keptMonthEnd, removed: remove.length },
  };
}

/**
 * 間引いた結果が妥当かを確かめる。
 *
 * **月末の記録が消えていないか**を見ます。
 * 条件の書き間違いで過去が消えると、元に戻せません。
 *
 * @param plan 間引きの判断
 * @returns 問題があればその説明（無ければ空）
 */
export function verifyRetention(plan: RetentionPlan): string[] {
  const issues: string[] = [];

  // 月末の記録が remove に入っていないか
  for (const s of plan.remove) {
    const date = dateOf(s.takenAt);
    if (!isLastDayOfMonth(date)) continue;
    // 同じ口座・同じ日の記録が keep にあるなら問題ない（同日の重複）
    const kept = plan.keep.some(
      (k) => k.walletableId === s.walletableId && dateOf(k.takenAt) === date,
    );
    if (!kept) {
      issues.push(`月末の記録が残りません: 口座 ${s.walletableId} / ${date}`);
    }
  }

  // すべて消えるのは、まず条件の誤り
  if (plan.keep.length === 0 && plan.remove.length > 0) {
    issues.push("残すものが 1 件もありません。条件を確かめてください");
  }

  return issues;
}
