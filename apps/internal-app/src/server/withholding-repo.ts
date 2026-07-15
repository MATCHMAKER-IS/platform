/**
 * 報酬の源泉徴収・支払調書リポジトリ。個人（士業・デザイナー等）への報酬支払に源泉徴収税を適用し、
 * 年間の支払調書サマリーを作る。源泉税の計算は @platform/tax に委譲する。
 * @packageDocumentation
 */
import { applyWithholding, type WithholdingResult } from "@platform/tax";

/** 報酬支払 1 件（base は税抜の報酬本体）。 */
export interface FeePayment {
  payee: string;
  category: string;
  base: number;
  paidAt: string;
}

/** 源泉税を算出した支払明細。 */
export interface FeePaymentView extends FeePayment {
  withholding: number;
  net: number;
}

/** 支払調書（支払先ごとの年間集計）。 */
export interface PayeeReport {
  payee: string;
  category: string;
  count: number;
  totalPayment: number;
  totalWithholding: number;
}

function toView(p: FeePayment): FeePaymentView {
  const w: WithholdingResult = applyWithholding(p.base);
  return { ...p, withholding: w.withholding, net: w.net };
}

/** 年（YYYY）で絞り、支払先×区分ごとに支払額・源泉税を集計する。 */
export function reportByPayee(payments: FeePayment[], year: string): PayeeReport[] {
  const byKey = new Map<string, PayeeReport>();
  const order: string[] = [];
  for (const p of payments) {
    if (!p.paidAt.startsWith(year)) continue;
    const key = `${p.payee}\u0000${p.category}`;
    let rep = byKey.get(key);
    if (!rep) {
      rep = { payee: p.payee, category: p.category, count: 0, totalPayment: 0, totalWithholding: 0 };
      byKey.set(key, rep);
      order.push(key);
    }
    const w = applyWithholding(p.base);
    rep.count += 1;
    rep.totalPayment += p.base;
    rep.totalWithholding += w.withholding;
  }
  return order.map((k) => byKey.get(k)!);
}

/** 報酬支払ストア。 */
export interface FeePaymentStore {
  record(payment: FeePayment): Promise<FeePaymentView>;
  list(year?: string): Promise<FeePaymentView[]>;
  report(year: string): Promise<PayeeReport[]>;
}

/** インメモリ実装。 */
export function createMemoryFeePaymentStore(): FeePaymentStore {
  const payments: FeePayment[] = [];
  return {
    async record(payment) {
      payments.push(payment);
      return toView(payment);
    },
    async list(year) {
      return payments.filter((p) => !year || p.paidAt.startsWith(year)).map(toView);
    },
    async report(year) {
      return reportByPayee(payments, year);
    },
  };
}

// ── Prisma 実装 ──

/** FeePaymentRow の必要部分。 */
export interface FeePaymentRow {
  id: string;
  payee: string;
  category: string;
  base: number;
  paidAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface FeePaymentStoreDb {
  feePaymentRow: {
    findMany(args: { orderBy: { paidAt: "asc" } }): Promise<FeePaymentRow[]>;
    create(args: { data: { payee: string; category: string; base: number; paidAt: string } }): Promise<FeePaymentRow>;
  };
}

function rowToPayment(row: FeePaymentRow): FeePayment {
  return { payee: row.payee, category: row.category, base: row.base, paidAt: row.paidAt };
}

/** Prisma 実装。 */
export function createPrismaFeePaymentStore(db: FeePaymentStoreDb): FeePaymentStore {
  return {
    async record(payment) {
      await db.feePaymentRow.create({ data: { payee: payment.payee, category: payment.category, base: payment.base, paidAt: payment.paidAt } });
      return toView(payment);
    },
    async list(year) {
      return (await db.feePaymentRow.findMany({ orderBy: { paidAt: "asc" } })).map(rowToPayment).filter((p) => !year || p.paidAt.startsWith(year)).map(toView);
    },
    async report(year) {
      return reportByPayee((await db.feePaymentRow.findMany({ orderBy: { paidAt: "asc" } })).map(rowToPayment), year);
    },
  };
}
