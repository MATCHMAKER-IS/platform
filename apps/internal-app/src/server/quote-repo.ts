/**
 * 見積リポジトリ。合計計算・状態・請求書化は @platform/quote に委譲する。
 * @packageDocumentation
 */
import { buildQuote, quoteStatus, daysUntilExpiry, convertToInvoice, type Quote, type QuoteStatus, type Invoice, type InvoiceLine } from "@platform/quote";

/** 見積の状態遷移で受け付ける値。 */
export type QuoteState = "draft" | "sent" | "accepted" | "rejected";

/** 保存する見積。 */
export interface QuoteRecord extends Quote {
  state: QuoteState;
}

/** 一覧・詳細に付ける算出値。 */
export interface QuoteView extends QuoteRecord {
  status: QuoteStatus;
  daysLeft: number;
}

function toView(rec: QuoteRecord, now: Date): QuoteView {
  return { ...rec, status: quoteStatus(rec, now), daysLeft: daysUntilExpiry(rec, now) };
}

/** 見積ヘッダ。 */
export interface QuoteHeaderInput {
  number: string;
  issueDate: string;
  validUntil: string;
  billTo: string;
}

/** 見積ストア。 */
export interface QuoteStore {
  list(now?: Date): Promise<QuoteView[]>;
  get(number: string, now?: Date): Promise<QuoteView | undefined>;
  create(header: QuoteHeaderInput, lines: InvoiceLine[]): Promise<QuoteRecord>;
  setState(number: string, state: QuoteState): Promise<QuoteView | undefined>;
  /** 見積を請求書に変換する（見積は accepted になる）。請求書本体の永続化は呼び出し側で行う。 */
  toInvoice(number: string, header: { number: string; issueDate: string; dueDate: string; registrationNumber?: string }): Promise<Invoice | undefined>;
}

/** インメモリ実装。 */
export function createMemoryQuoteStore(): QuoteStore {
  const byNumber = new Map<string, QuoteRecord>();
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
      const quote = buildQuote({ ...header, state: "draft" }, lines);
      const rec: QuoteRecord = { ...quote, state: "draft" };
      byNumber.set(header.number, rec);
      if (!order.includes(header.number)) order.push(header.number);
      return rec;
    },
    async setState(number, state) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      rec.state = state;
      return toView(rec, new Date());
    },
    async toInvoice(number, header) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      const invoice = convertToInvoice(rec, header);
      rec.state = "accepted";
      return invoice;
    },
  };
}

// ── Prisma 実装 ──

/** QuoteRow の必要部分（明細は JSON）。 */
export interface QuoteRow {
  number: string;
  issueDate: string;
  validUntil: string;
  billTo: string;
  lines: unknown;
  subtotal: number;
  tax: number;
  total: number;
  state: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface QuoteStoreDb {
  quoteRow: {
    findMany(args: { orderBy: { issueDate: "asc" } }): Promise<QuoteRow[]>;
    findUnique(args: { where: { number: string } }): Promise<QuoteRow | null>;
    create(args: { data: QuoteRow }): Promise<QuoteRow>;
    update(args: { where: { number: string }; data: { state: string } }): Promise<QuoteRow>;
  };
}

function normalizeState(state: string): QuoteState {
  return state === "sent" || state === "accepted" || state === "rejected" ? state : "draft";
}

function rowToRecord(row: QuoteRow): QuoteRecord {
  const lines = Array.isArray(row.lines) ? (row.lines as InvoiceLine[]) : [];
  const quote = buildQuote({ number: row.number, issueDate: row.issueDate, validUntil: row.validUntil, billTo: row.billTo, state: normalizeState(row.state) }, lines);
  return { ...quote, state: normalizeState(row.state) };
}

/** Prisma 実装。 */
export function createPrismaQuoteStore(db: QuoteStoreDb): QuoteStore {
  return {
    async list(now = new Date()) {
      return (await db.quoteRow.findMany({ orderBy: { issueDate: "asc" } })).map((r) => toView(rowToRecord(r), now));
    },
    async get(number, now = new Date()) {
      const row = await db.quoteRow.findUnique({ where: { number } });
      return row ? toView(rowToRecord(row), now) : undefined;
    },
    async create(header, lines) {
      const quote = buildQuote({ ...header, state: "draft" }, lines);
      await db.quoteRow.create({ data: { number: header.number, issueDate: header.issueDate, validUntil: header.validUntil, billTo: header.billTo, lines, subtotal: quote.totals.subtotal, tax: quote.totals.tax, total: quote.totals.total, state: "draft" } });
      return { ...quote, state: "draft" };
    },
    async setState(number, state) {
      const row = await db.quoteRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.quoteRow.update({ where: { number }, data: { state } });
      return toView(rowToRecord(updated), new Date());
    },
    async toInvoice(number, header) {
      const row = await db.quoteRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const invoice = convertToInvoice(rowToRecord(row), header);
      await db.quoteRow.update({ where: { number }, data: { state: "accepted" } });
      return invoice;
    },
  };
}
