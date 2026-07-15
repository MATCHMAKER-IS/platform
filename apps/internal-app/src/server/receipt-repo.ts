/**
 * 入金記録（日付つき）ストア。請求への入金を日付つきで残し、資金繰りの現金収入に使う。
 * 買掛の支払記録（purchase-payment）と対称。
 * @packageDocumentation
 */

/** 請求への入金 1 件。 */
export interface InvoiceReceipt {
  invoiceNumber: string;
  amount: number;
  receivedAt: string;
}

/** 入金記録ストア。 */
export interface ReceiptStore {
  record(invoiceNumber: string, amount: number, receivedAt?: string): Promise<InvoiceReceipt>;
  list(): Promise<InvoiceReceipt[]>;
}

/** インメモリ実装。 */
export function createMemoryReceiptStore(): ReceiptStore {
  const receipts: InvoiceReceipt[] = [];
  return {
    async record(invoiceNumber, amount, receivedAt = new Date().toISOString()) {
      const r: InvoiceReceipt = { invoiceNumber, amount, receivedAt };
      receipts.push(r);
      return r;
    },
    async list() {
      return receipts.slice();
    },
  };
}

// ── Prisma 実装 ──

/** InvoiceReceiptRow の必要部分。 */
export interface InvoiceReceiptRow {
  id: string;
  invoiceNumber: string;
  amount: number;
  receivedAt: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReceiptStoreDb {
  invoiceReceiptRow: {
    findMany(args: { orderBy: { receivedAt: "asc" } }): Promise<InvoiceReceiptRow[]>;
    create(args: { data: { invoiceNumber: string; amount: number; receivedAt: string } }): Promise<InvoiceReceiptRow>;
  };
}

/** Prisma 実装。 */
export function createPrismaReceiptStore(db: ReceiptStoreDb): ReceiptStore {
  return {
    async record(invoiceNumber, amount, receivedAt = new Date().toISOString()) {
      const row = await db.invoiceReceiptRow.create({ data: { invoiceNumber, amount, receivedAt } });
      return { invoiceNumber: row.invoiceNumber, amount: row.amount, receivedAt: row.receivedAt };
    },
    async list() {
      return (await db.invoiceReceiptRow.findMany({ orderBy: { receivedAt: "asc" } })).map((r) => ({ invoiceNumber: r.invoiceNumber, amount: r.amount, receivedAt: r.receivedAt }));
    },
  };
}
