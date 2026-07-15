/**
 * 発注リポジトリ。発注書を永続化し、入荷実績から入荷状況を集計する。
 * 状態・入荷判定は @platform/purchase に委譲する。SKU 列を持ち発注→在庫の連携に使う。
 * @packageDocumentation
 */
import { receivingStatus, totalOutstanding, purchaseStatus, purchaseTotals, type PurchaseOrder, type Receipt, type LineReceivingStatus, type PurchaseStatus } from "@platform/purchase";

/** 保存する発注（発注書＋SKU列＋入荷実績）。 */
export interface PurchaseOrderRecord {
  number: string;
  order: PurchaseOrder;
  skus: (string | null)[];
  receipts: Receipt[];
}

/** 一覧・詳細に付ける算出値。 */
export interface PurchaseOrderView extends PurchaseOrderRecord {
  status: PurchaseStatus;
  lineStatus: LineReceivingStatus[];
  outstanding: number;
}

function toView(rec: PurchaseOrderRecord): PurchaseOrderView {
  return { ...rec, status: purchaseStatus(rec.order, rec.receipts), lineStatus: receivingStatus(rec.order.lines, rec.receipts), outstanding: totalOutstanding(rec.order.lines, rec.receipts) };
}

/** 入荷記録の結果（在庫連携用に、入荷分の SKU と数量を返す）。 */
export interface ReceiptResult {
  view: PurchaseOrderView;
  inbound?: { sku: string; quantity: number };
}

/** 発注ストア。 */
export interface PurchaseStore {
  list(): Promise<PurchaseOrderView[]>;
  get(number: string): Promise<PurchaseOrderView | undefined>;
  create(order: PurchaseOrder, skus?: (string | null)[]): Promise<PurchaseOrderRecord>;
  recordReceipt(number: string, receipt: Receipt): Promise<ReceiptResult | undefined>;
  setState(number: string, state: "draft" | "ordered" | "cancelled"): Promise<PurchaseOrderView | undefined>;
}

/** インメモリ実装。 */
export function createMemoryPurchaseStore(): PurchaseStore {
  const byNumber = new Map<string, PurchaseOrderRecord>();
  const order: string[] = [];
  return {
    async list() {
      return order.map((n) => toView(byNumber.get(n)!));
    },
    async get(number) {
      const rec = byNumber.get(number);
      return rec ? toView(rec) : undefined;
    },
    async create(po, skus) {
      const rec: PurchaseOrderRecord = { number: po.number, order: po, skus: skus ?? po.lines.map(() => null), receipts: [] };
      byNumber.set(po.number, rec);
      if (!order.includes(po.number)) order.push(po.number);
      return rec;
    },
    async recordReceipt(number, receipt) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      rec.receipts.push(receipt);
      const sku = rec.skus[receipt.lineIndex] ?? null;
      const result: ReceiptResult = { view: toView(rec) };
      if (sku && receipt.quantity > 0) result.inbound = { sku, quantity: receipt.quantity };
      return result;
    },
    async setState(number, state) {
      const rec = byNumber.get(number);
      if (!rec) return undefined;
      rec.order = { ...rec.order, state };
      return toView(rec);
    },
  };
}

// ── Prisma 実装 ──

/** PurchaseOrderRow の必要部分（明細・SKU・入荷は JSON）。 */
export interface PurchaseOrderRow {
  number: string;
  orderDate: string;
  supplier: string;
  dueDate: string | null;
  lines: unknown;
  skus: unknown;
  receipts: unknown;
  subtotal: number;
  tax: number;
  total: number;
  state: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PurchaseStoreDb {
  purchaseOrderRow: {
    findMany(args: { orderBy: { orderDate: "asc" } }): Promise<PurchaseOrderRow[]>;
    findUnique(args: { where: { number: string } }): Promise<PurchaseOrderRow | null>;
    create(args: { data: PurchaseOrderRow }): Promise<PurchaseOrderRow>;
    update(args: { where: { number: string }; data: { receipts?: unknown; state?: string } }): Promise<PurchaseOrderRow>;
  };
}

function normalizeOrderState(state: string): "draft" | "ordered" | "cancelled" {
  return state === "draft" || state === "cancelled" ? state : "ordered";
}

function rowToRecord(row: PurchaseOrderRow): PurchaseOrderRecord {
  const lines = Array.isArray(row.lines) ? (row.lines as PurchaseOrder["lines"]) : [];
  const order: PurchaseOrder = { number: row.number, orderDate: row.orderDate, supplier: row.supplier, lines, totals: purchaseTotals(lines), state: normalizeOrderState(row.state) };
  if (row.dueDate) order.dueDate = row.dueDate;
  return { number: row.number, order, skus: Array.isArray(row.skus) ? (row.skus as (string | null)[]) : lines.map(() => null), receipts: Array.isArray(row.receipts) ? (row.receipts as Receipt[]) : [] };
}

/** Prisma 実装。 */
export function createPrismaPurchaseStore(db: PurchaseStoreDb): PurchaseStore {
  return {
    async list() {
      return (await db.purchaseOrderRow.findMany({ orderBy: { orderDate: "asc" } })).map((r) => toView(rowToRecord(r)));
    },
    async get(number) {
      const row = await db.purchaseOrderRow.findUnique({ where: { number } });
      return row ? toView(rowToRecord(row)) : undefined;
    },
    async create(po, skus) {
      await db.purchaseOrderRow.create({ data: { number: po.number, orderDate: po.orderDate, supplier: po.supplier, dueDate: po.dueDate ?? null, lines: po.lines, skus: skus ?? po.lines.map(() => null), receipts: [], subtotal: po.totals.subtotal, tax: po.totals.tax, total: po.totals.total, state: po.state ?? "ordered" } });
      return { number: po.number, order: po, skus: skus ?? po.lines.map(() => null), receipts: [] };
    },
    async recordReceipt(number, receipt) {
      const row = await db.purchaseOrderRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const rec = rowToRecord(row);
      rec.receipts.push(receipt);
      await db.purchaseOrderRow.update({ where: { number }, data: { receipts: rec.receipts } });
      const sku = rec.skus[receipt.lineIndex] ?? null;
      const result: ReceiptResult = { view: toView(rec) };
      if (sku && receipt.quantity > 0) result.inbound = { sku, quantity: receipt.quantity };
      return result;
    },
    async setState(number, state) {
      const row = await db.purchaseOrderRow.findUnique({ where: { number } });
      if (!row) return undefined;
      const updated = await db.purchaseOrderRow.update({ where: { number }, data: { state } });
      return toView(rowToRecord(updated));
    },
  };
}
