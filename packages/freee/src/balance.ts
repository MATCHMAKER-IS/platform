/**
 * 口座残高の集計。
 *
 * freee から取れるのは**口座の一覧（今の残高）**と**明細**です。
 * 「先月末はいくらだったか」「この 3 か月でどう動いたか」は、
 * 明細から**逆算**する必要があります。
 *
 * 逆算するときの注意:
 *   - **入金・出金は符号ではなく `entry_side` で判断する**（freee は amount を正で返す）
 *   - 今の残高から過去へ遡る（明細の `balance` は欠けることがある）
 *   - 明細が無い日は**前日の残高を引き継ぐ**（0 にすると急落して見える）
 * @packageDocumentation
 */
import type { FreeeWalletable, FreeeWalletTxn } from "./index";

/** ある日の残高。 */
export interface BalancePoint {
  /** 日付（YYYY-MM-DD）。 */
  date: string;
  /** その日の終わりの残高（円）。 */
  balance: number;
  /** その日の入金合計（円）。 */
  income: number;
  /** その日の出金合計（円）。 */
  expense: number;
}

/** 口座ごとの推移。 */
export interface WalletBalanceHistory {
  walletableId: number;
  name: string;
  type: FreeeWalletable["type"];
  /** 日付の昇順。 */
  points: BalancePoint[];
}

/** 日付を 1 日進める。 */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 明細から、日ごとの残高の推移を作る。
 *
 * **今の残高から過去へ遡って計算します。** 明細に載っている `balance` は
 * 欠けることがあるため、それには頼りません。
 *
 * @param wallet   口座（今の残高を持つ）
 * @param txns     その口座の明細（期間内のすべて）
 * @param from     開始日（YYYY-MM-DD）
 * @param to       終了日（YYYY-MM-DD）
 * @returns 日付昇順の推移
 *
 * @example
 * ```ts
 * const history = buildBalanceHistory(wallet, txns, "2026-04-01", "2026-06-30");
 * // → [{ date: "2026-04-01", balance: 1_200_000, income: 0, expense: 0 }, …]
 * ```
 */
export function buildBalanceHistory(
  wallet: FreeeWalletable,
  txns: readonly FreeeWalletTxn[],
  from: string,
  to: string,
): WalletBalanceHistory {
  // 日ごとの増減をまとめる
  const byDate = new Map<string, { income: number; expense: number }>();
  for (const t of txns) {
    if (t.date < from || t.date > to) continue;
    const cur = byDate.get(t.date) ?? { income: 0, expense: 0 };
    // freee は amount を正で返す。入出金は entry_side で判断する
    if (t.entry_side === "income") cur.income += t.amount;
    else cur.expense += t.amount;
    byDate.set(t.date, cur);
  }

  // 現在の残高から遡る。期間の終わりを起点にする
  const latest = wallet.last_balance ?? wallet.walletable_balance ?? 0;

  // まず日付を並べる（明細が無い日も埋める）
  const dates: string[] = [];
  for (let d = from; d <= to; d = nextDay(d)) dates.push(d);

  // 終わりから逆に辿って、各日の残高を出す
  const balances = new Map<string, number>();
  let running = latest;
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const d = dates[i]!;
    balances.set(d, running);
    const m = byDate.get(d);
    // その日の増減を打ち消すと、前日の残高になる
    if (m) running = running - m.income + m.expense;
  }

  return {
    walletableId: wallet.id,
    name: wallet.name,
    type: wallet.type,
    points: dates.map((d) => {
      const m = byDate.get(d) ?? { income: 0, expense: 0 };
      return { date: d, balance: balances.get(d) ?? 0, income: m.income, expense: m.expense };
    }),
  };
}

/**
 * 複数の口座を合算する。
 *
 * **クレジットカードは負債**なので、単純に足すと実際より多く見えます。
 * 合算するかどうかを `includeCreditCard` で選べるようにしてあります。
 *
 * @param histories 口座ごとの推移（同じ期間であること）
 * @param options   クレジットカードを含めるか（既定 false）
 * @returns 合算した推移
 */
export function totalBalance(
  histories: readonly WalletBalanceHistory[],
  options: { includeCreditCard?: boolean } = {},
): BalancePoint[] {
  const include = options.includeCreditCard ?? false;
  const target = histories.filter((h) => include || h.type !== "credit_card");
  if (target.length === 0) return [];

  const dates = target[0]!.points.map((p) => p.date);
  return dates.map((date, i) => {
    let balance = 0, income = 0, expense = 0;
    for (const h of target) {
      const p = h.points[i];
      if (!p || p.date !== date) continue;
      balance += p.balance;
      income += p.income;
      expense += p.expense;
    }
    return { date, balance, income, expense };
  });
}

/** 残高の要約。 */
export interface BalanceSummary {
  /** 期間の最後の残高。 */
  latest: number;
  /** 期間の最初からの増減。 */
  change: number;
  /** 期間中の最小。 */
  min: number;
  /** 期間中の最大。 */
  max: number;
  /** 残高が最も少なかった日。**資金繰りで最初に見る**。 */
  minDate: string;
}

/**
 * 推移から要約を出す。
 *
 * **最小と、それがいつだったか**を必ず返します。
 * 平均や最新だけでは、月末に資金が足りなくなる兆候を見逃します。
 *
 * @param points 日付昇順の推移
 * @returns 要約（空なら null）
 */
export function summarizeBalance(points: readonly BalancePoint[]): BalanceSummary | null {
  if (points.length === 0) return null;
  let min = points[0]!.balance, max = points[0]!.balance, minDate = points[0]!.date;
  for (const p of points) {
    if (p.balance < min) { min = p.balance; minDate = p.date; }
    if (p.balance > max) max = p.balance;
  }
  return {
    latest: points[points.length - 1]!.balance,
    change: points[points.length - 1]!.balance - points[0]!.balance,
    min,
    max,
    minDate,
  };
}
