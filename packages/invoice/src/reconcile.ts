/**
 * 入金消込・繰越・売掛金年齢表(純ロジック)。
 * 入金を古い請求書から順に充当し(消込)、未収残高の繰越や年齢別集計を行う。
 * @packageDocumentation
 */
import { balanceDue } from "./payment";

/** 消込対象の未収請求書。 */
/**
 * 「今」を **JST の日付**として UTC 0 時に正規化する。
 *
 * **`new Date()` をそのまま使わない。** UTC で動くサーバ(クラウドの既定)では
 * JST の 00:00〜08:59 が前日として扱われ、**判定が 1 日ずれる**。
 * `@platform/datetime` に依存を増やさないための最小実装
 * (9 時間ずらして UTC として読むだけ。`formatDateJst` と同じ計算)。
 */
function todayUtcFromJst(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${jst}T00:00:00.000Z`);
}

export interface OpenInvoice {
  number: string;
  /** 支払期限(ISO)。 */
  dueDate: string;
  /** 請求合計。 */
  total: number;
  /** 入金済み額。 */
  paidAmount: number;
}

/** 消込結果。 */
export interface ApplyPaymentResult {
  /** 充当後の請求書(paidAmount 更新)。 */
  invoices: OpenInvoice[];
  /** 充当しきれなかった入金額(過入金/前受)。 */
  unapplied: number;
  /** 今回充当した明細。 */
  applied: { number: string; amount: number }[];
}

/**
 * 入金を請求書に充当する(FIFO 消込)。
 *
 * **古い期限から順に充当する**のが会計の慣習。新しいものから充当すると、
 * 古い債権がいつまでも残り、年齢表が実態と合わなくなる。
 *
 * @param invoices 入金
 * @param amount 請求書の配列
 * @returns 充当の内訳と、**充当しきれなかった額**
 */
export function applyPayment(invoices: OpenInvoice[], amount: number): ApplyPaymentResult {
  const sorted = [...invoices].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  let remaining = Math.max(0, amount);
  const applied: { number: string; amount: number }[] = [];
  const result = sorted.map((inv) => {
    const bal = balanceDue(inv.total, inv.paidAmount);
    if (remaining <= 0 || bal <= 0) return inv;
    const use = Math.min(remaining, bal);
    remaining -= use;
    applied.push({ number: inv.number, amount: use });
    return { ...inv, paidAmount: inv.paidAmount + use };
  });
  return { invoices: result, unapplied: remaining, applied };
}

/**
 * 複数の入金を順に充当する。
 *
 * @param invoices 請求書の配列
 * @param payments 入金の配列
 * @returns 充当の内訳
 */
export function reconcile(invoices: OpenInvoice[], payments: number[]): ApplyPaymentResult {
  let state = invoices;
  let unapplied = 0;
  const applied: { number: string; amount: number }[] = [];
  for (const p of payments) {
    const r = applyPayment(state, p + unapplied);
    state = r.invoices;
    unapplied = r.unapplied;
    applied.push(...r.applied);
  }
  return { invoices: state, unapplied, applied };
}

/**
 * 未収残高の合計を返す(繰越額)。
 *
 * @param invoices 請求書の配列
 * @returns 合計残高
 */
export function outstandingTotal(invoices: OpenInvoice[]): number {
  return invoices.reduce((sum, inv) => sum + balanceDue(inv.total, inv.paidAmount), 0);
}

/** 売掛金年齢表(期限からの経過日数で区分)。 */
export interface AgingBuckets {
  /** 未到来/当日(期限前)。 */
  current: number;
  /** 1〜30 日超過。 */
  d1_30: number;
  /** 31〜60 日超過。 */
  d31_60: number;
  /** 61〜90 日超過。 */
  d61_90: number;
  /** 90 日超過。 */
  over90: number;
  /** 合計。 */
  total: number;
}

/**
 * 売掛金年齢表を作る。
 *
 * **回収が遅れている債権を見つける**(30 日以内・60 日・90 日超)。
 * 90 日を超えると回収率が大きく落ちるので、早期に手を打つ。
 *
 * @param invoices 未回収の請求書(`total` と `paidAmount` を持ち、**入金は差引済み**。
 *   入金の配列は受け取らない)
 * @param asOf 基準日(既定は現在。テスト注入用)
 * @returns 年齢別の残高
 */
export function agingBuckets(invoices: OpenInvoice[], asOf: Date = todayUtcFromJst()): AgingBuckets {
  const b: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, total: 0 };
  // 日付だけの比較。UTC で揃える(実行環境のタイムゾーンで結果を変えない)
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  for (const inv of invoices) {
    const bal = balanceDue(inv.total, inv.paidAmount);
    if (bal <= 0) continue;
    const due = new Date(inv.dueDate);
    const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const overdueDays = Math.round((today - dueDay) / 86_400_000);
    if (overdueDays <= 0) b.current += bal;
    else if (overdueDays <= 30) b.d1_30 += bal;
    else if (overdueDays <= 60) b.d31_60 += bal;
    else if (overdueDays <= 90) b.d61_90 += bal;
    else b.over90 += bal;
    b.total += bal;
  }
  return b;
}
