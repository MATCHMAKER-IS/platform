/**
 * 入金消込・繰越・売掛金年齢表(純ロジック)。
 * 入金を古い請求書から順に充当し(消込)、未収残高の繰越や年齢別集計を行う。
 * @packageDocumentation
 */
import { balanceDue } from "./payment.js";

/** 消込対象の未収請求書。 */
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

/** 入金を古い期限の請求書から順に充当する(FIFO 消込)。 */
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

/** 複数の入金を順に充当する。 */
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

/** 未収残高の合計(繰越額)。 */
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

/** 請求書群を売掛金年齢表に集計する。 */
export function agingBuckets(invoices: OpenInvoice[], asOf: Date = new Date()): AgingBuckets {
  const b: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, total: 0 };
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()).getTime();
  for (const inv of invoices) {
    const bal = balanceDue(inv.total, inv.paidAmount);
    if (bal <= 0) continue;
    const due = new Date(inv.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
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
