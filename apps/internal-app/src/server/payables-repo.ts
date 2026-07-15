/**
 * 買掛金（債務）リポジトリ。発注に対する支払を記録し、買掛金エイジングと支払予定を集計する。
 * エイジングは @platform/invoice の agingBuckets を流用する（売掛と対称）。
 * @packageDocumentation
 */
import { agingBuckets, outstandingTotal, balanceDue, type AgingBuckets, type OpenInvoice } from "@platform/invoice";

/** 買掛金の元になる発注（支払期限が無ければ発注日を期限とみなす）。 */
export interface PayableOrder {
  number: string;
  supplier: string;
  orderDate: string;
  dueDate?: string;
  total: number;
  paidAmount: number;
  cancelled: boolean;
}

/** 支払予定 1 件。 */
export interface PayableDue {
  number: string;
  supplier: string;
  dueDate: string;
  amountDue: number;
  overdueDays: number;
}

/** 買掛金サマリー。 */
export interface PayablesSummary {
  aging: AgingBuckets;
  outstanding: number;
  upcoming: PayableDue[];
}

function dueDateOf(o: PayableOrder): string {
  return o.dueDate ?? o.orderDate;
}

/** 発注（＋支払済み額）から買掛金エイジングと支払予定を作る。取消・完済は除外。 */
export function payablesSummary(orders: PayableOrder[], now: Date = new Date()): PayablesSummary {
  const open = orders.filter((o) => !o.cancelled && balanceDue(o.total, o.paidAmount) > 0);
  const asOpen: OpenInvoice[] = open.map((o) => ({ number: o.number, dueDate: dueDateOf(o), total: o.total, paidAmount: o.paidAmount }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const upcoming: PayableDue[] = open
    .map((o) => {
      const due = new Date(dueDateOf(o));
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
      return { number: o.number, supplier: o.supplier, dueDate: dueDateOf(o), amountDue: balanceDue(o.total, o.paidAmount), overdueDays: Math.round((today - dueDay) / 86_400_000) };
    })
    .sort((a, b) => b.overdueDays - a.overdueDays);
  return { aging: agingBuckets(asOpen, now), outstanding: outstandingTotal(asOpen), upcoming };
}

// ── 支払記録ストア ──

/** 発注に対する支払 1 件。 */
export interface PurchasePayment {
  poNumber: string;
  amount: number;
  paidAt: string;
}

/** 支払記録ストア。 */
export interface PurchasePaymentStore {
  record(poNumber: string, amount: number, paidAt?: string): Promise<PurchasePayment>;
  /** 発注番号ごとの支払済み合計。 */
  paidByOrder(): Promise<Record<string, number>>;
  list(): Promise<PurchasePayment[]>;
}

/** インメモリ実装。 */
export function createMemoryPurchasePaymentStore(): PurchasePaymentStore {
  const payments: PurchasePayment[] = [];
  return {
    async record(poNumber, amount, paidAt = new Date().toISOString()) {
      const p: PurchasePayment = { poNumber, amount, paidAt };
      payments.push(p);
      return p;
    },
    async paidByOrder() {
      const map: Record<string, number> = {};
      for (const p of payments) map[p.poNumber] = (map[p.poNumber] ?? 0) + p.amount;
      return map;
    },
    async list() {
      return payments.slice();
    },
  };
}

// ── Prisma 実装 ──

/** PurchasePaymentRow の必要部分。 */
export interface PurchasePaymentRow {
  id: string;
  poNumber: string;
  amount: number;
  paidAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PurchasePaymentStoreDb {
  purchasePaymentRow: {
    findMany(args: { orderBy: { paidAt: "asc" } }): Promise<PurchasePaymentRow[]>;
    create(args: { data: { poNumber: string; amount: number; paidAt: string } }): Promise<PurchasePaymentRow>;
  };
}

/** Prisma 実装。 */
export function createPrismaPurchasePaymentStore(db: PurchasePaymentStoreDb): PurchasePaymentStore {
  return {
    async record(poNumber, amount, paidAt = new Date().toISOString()) {
      const row = await db.purchasePaymentRow.create({ data: { poNumber, amount, paidAt } });
      return { poNumber: row.poNumber, amount: row.amount, paidAt: row.paidAt };
    },
    async paidByOrder() {
      const rows = await db.purchasePaymentRow.findMany({ orderBy: { paidAt: "asc" } });
      const map: Record<string, number> = {};
      for (const r of rows) map[r.poNumber] = (map[r.poNumber] ?? 0) + r.amount;
      return map;
    },
    async list() {
      return (await db.purchasePaymentRow.findMany({ orderBy: { paidAt: "asc" } })).map((r) => ({ poNumber: r.poNumber, amount: r.amount, paidAt: r.paidAt }));
    },
  };
}
