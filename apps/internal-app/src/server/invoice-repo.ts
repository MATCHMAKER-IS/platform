/**
 * 請求書リポジトリ。明細から合計・入金状況を計算するロジックは @platform/invoice に委譲する。
 * @packageDocumentation
 */
import { buildInvoice, invoiceTotals, paymentStatus, balanceDue, type Invoice, type InvoiceHeader, type InvoiceLine, type PaymentStatus } from "@platform/invoice";

/** 保存する請求書（請求書＋発行/入金/取消の状態）。 */
export interface InvoiceRecord extends Invoice {
  issued: boolean;
  paidAmount: number;
  cancelled: boolean;
}

/** 一覧・詳細に付ける算出値。 */
export interface InvoiceView extends InvoiceRecord {
  status: PaymentStatus;
  balance: number;
}

function toView(rec: InvoiceRecord, now: Date): InvoiceView {
  const status = paymentStatus({ issued: rec.issued, cancelled: rec.cancelled, dueDate: rec.dueDate, paidAmount: rec.paidAmount, total: rec.totals.total }, now);
  return { ...rec, status, balance: balanceDue(rec.totals.total, rec.paidAmount) };
}

/** 請求書ストア。 */
export interface InvoiceStore {
  list(now?: Date): Promise<InvoiceView[]>;
  get(number: string, now?: Date): Promise<InvoiceView | undefined>;
  create(header: InvoiceHeader, lines: InvoiceLine[]): Promise<InvoiceRecord>;
  recordPayment(number: string, amount: number): Promise<InvoiceView | undefined>;
  cancel(number: string): Promise<InvoiceView | undefined>;
}

/** インメモリ実装。 */
export function createMemoryInvoiceStore(): InvoiceStore {
  const byNumber = new Map<string, InvoiceRecord>();
  const order: string[] = [];
  return {
    async list(now = new Date()) {
      return order.map((n) => toView(byNumber.get(n)!, now));
    },
    async get(number, now = new Date()) {
      const rec = byNumber.get(number);
      return rec ? toView(rec, now) : undefined;
    },
    async create(header, lines) {
      const invoice = buildInvoice(header, lines);
      const rec: InvoiceRecord = { ...invoice, issued: true, paidAmount: 0, cancelled: false };
      byNumber.set(header.number, rec);
      if (!order.includes(header.number)) order.push(header.number);
      return rec;
    },
    async recordPayment(number, amount) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      rec.paidAmount += Math.max(0, amount);
      return toView(rec, new Date());
    },
    async cancel(number) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      rec.cancelled = true;
      return toView(rec, new Date());
    },
  };
}

// ── Prisma 実装 ──

/** InvoiceRow の必要部分（明細は JSON で保持）。 */
export interface InvoiceRow {
  number: string;
  issueDate: string;
  dueDate: string;
  registrationNumber: string | null;
  billTo: string;
  lines: unknown;
  subtotal: number;
  tax: number;
  total: number;
  issued: boolean;
  paidAmount: number;
  cancelled: boolean;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface InvoiceStoreDb {
  invoiceRow: {
    findMany(args: { orderBy: { issueDate: "asc" } }): Promise<InvoiceRow[]>;
    findUnique(args: { where: { number: string } }): Promise<InvoiceRow | null>;
    create(args: { data: InvoiceRow }): Promise<InvoiceRow>;
    update(args: { where: { number: string }; data: { paidAmount?: number; cancelled?: boolean } }): Promise<InvoiceRow>;
  };
}

function rowToRecord(row: InvoiceRow): InvoiceRecord {
  const header: InvoiceHeader = { number: row.number, issueDate: row.issueDate, dueDate: row.dueDate, billTo: row.billTo };
  if (row.registrationNumber) header.registrationNumber = row.registrationNumber;
  const lines = Array.isArray(row.lines) ? (row.lines as InvoiceLine[]) : [];
  return { ...header, lines, totals: invoiceTotals(lines), issued: row.issued, paidAmount: row.paidAmount, cancelled: row.cancelled };
}

/** Prisma 実装。 */
export function createPrismaInvoiceStore(db: InvoiceStoreDb): InvoiceStore {
  return {
    async list(now = new Date()) {
      return (await db.invoiceRow.findMany({ orderBy: { issueDate: "asc" } })).map((r) => toView(rowToRecord(r), now));
    },
    async get(number, now = new Date()) {
      const row = await db.invoiceRow.findUnique({ where: { number } });
      return row ? toView(rowToRecord(row), now) : undefined;
    },
    async create(header, lines) {
      const invoice = buildInvoice(header, lines);
      await db.invoiceRow.create({ data: { number: header.number, issueDate: header.issueDate, dueDate: header.dueDate, registrationNumber: header.registrationNumber ?? null, billTo: header.billTo, lines, subtotal: invoice.totals.subtotal, tax: invoice.totals.tax, total: invoice.totals.total, issued: true, paidAmount: 0, cancelled: false } });
      return { ...invoice, issued: true, paidAmount: 0, cancelled: false };
    },
    async recordPayment(number, amount) {
      const row = await db.invoiceRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.invoiceRow.update({ where: { number }, data: { paidAmount: row.paidAmount + Math.max(0, amount) } });
      return toView(rowToRecord(updated), new Date());
    },
    async cancel(number) {
      const row = await db.invoiceRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.invoiceRow.update({ where: { number }, data: { cancelled: true } });
      return toView(rowToRecord(updated), new Date());
    },
  };
}
