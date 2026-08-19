/**
 * 請求書リポジトリ。明細から合計・入金状況を計算するロジックは @platform/invoice に委譲する。
 * @packageDocumentation
 */
import { buildInvoice, invoiceTotals, paymentStatus, balanceDue, type Invoice, type InvoiceHeader, type InvoiceLine, type PaymentStatus } from "@platform/invoice";
import { DEFAULT_LIST_LIMIT } from "./list-limit";

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
    findMany(args: { orderBy: { issueDate: "asc" }; take?: number }): Promise<InvoiceRow[]>;
    // **オーバーロード。** `select: { number: true }` を渡したときは
    // 絞った形が、そうでなければフルの `InvoiceRow` が返る——`recordPayment`
    // が存在確認だけに `select` を使っているのに、以前は型定義が
    // 対応しておらず、実装と食い違っていた(2026-08、全 route.ts の
    // 一括型検査で発見)。
    findUnique(args: { where: { number: string }; select: { number: true } }): Promise<{ number: string } | null>;
    findUnique(args: { where: { number: string } }): Promise<InvoiceRow | null>;
    create(args: { data: InvoiceRow }): Promise<InvoiceRow>;
    // **`{ increment: number }` を許可する。** `recordPayment` が DB 側の
    // アトミック加算(Lost Update 対策)に使っているのに、型定義には
    // 無かった(2026-08、同種のパターンを全 route.ts の一括型検査で発見)。
    update(args: { where: { number: string }; data: { paidAmount?: number | { increment: number }; cancelled?: boolean } }): Promise<InvoiceRow>;
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
      // **上限を置く。** 請求は毎月増えるので、全件返すといずれ画面が固まる
      // (ADR-0012 は一覧の取得を p95 300ms としている)
      return (await db.invoiceRow.findMany({ orderBy: { issueDate: "asc" }, take: DEFAULT_LIST_LIMIT }))
        .map((r) => toView(rowToRecord(r), now));
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
      // **`increment` で足す。** 2026-08 まで「読んで足して書く」形で、
      // **同時に 2 件の入金を記録すると片方が消えて**いた——
      // A が 1,000 円、B が 2,000 円を同時に記録すると、
      // どちらも「残高 0」を読むので、後に書いた方だけが残る(Lost Update)。
      // **入金が消えるのに誰も気づかない**——請求書は「未入金」のまま残り、
      // 督促されて初めて分かる。
      //
      // `increment` は DB 側で足すので、読み書きの間に割り込まれない。
      const exists = await db.invoiceRow.findUnique({ where: { number }, select: { number: true } });
      if (!exists) return undefined;
      const updated = await db.invoiceRow.update({
        where: { number },
        data: { paidAmount: { increment: Math.max(0, amount) } },
      });
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
