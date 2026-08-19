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

/**
 * InvoiceReceiptRow の必要部分。
 *
 * **`receivedAt` は DB では `Date`。** `ReceiptStore` の公開契約
 * (`InvoiceReceipt.receivedAt: string`)は変えない——この境界
 * (`rowToReceipt`)で変換する(2026-08、DB 層のみ移行)。
 */
export interface InvoiceReceiptRow {
  id: string;
  invoiceNumber: string;
  amount: number;
  receivedAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReceiptStoreDb {
  invoiceReceiptRow: {
    findMany(args: { take: number; orderBy: { receivedAt: "desc" } }): Promise<InvoiceReceiptRow[]>;
    create(args: { data: { invoiceNumber: string; amount: number; receivedAt: Date } }): Promise<InvoiceReceiptRow>;
  };
}

function rowToReceipt(row: InvoiceReceiptRow): InvoiceReceipt {
  return { invoiceNumber: row.invoiceNumber, amount: row.amount, receivedAt: row.receivedAt.toISOString() };
}

/** Prisma 実装。 */
export function createPrismaReceiptStore(db: ReceiptStoreDb): ReceiptStore {
  return {
    async record(invoiceNumber, amount, receivedAt = new Date().toISOString()) {
      const row = await db.invoiceReceiptRow.create({ data: { invoiceNumber, amount, receivedAt: new Date(receivedAt) } });
      return rowToReceipt(row);
    },
    async list() {
      // **上限を付ける。** **絞りが無く全件を返して**いました——
      // 入金は**年に数千件**になります。
      //
      // **並び順も `desc` に変えました**——上限で切るなら
      // **新しい方から**取らないと、**最近の入金が見えません**。
      return (await db.invoiceReceiptRow.findMany({ take: 500, orderBy: { receivedAt: "desc" } })).map(rowToReceipt);
    },
  };
}
