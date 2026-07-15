/**
 * 在庫リポジトリ。商品マスタと入出庫台帳を持ち、ロジックは @platform/inventory に委譲する。
 * 入出庫は倉庫・ロット・期限の情報も持てる（倉庫別在庫・期限切れ間近の集計に使う）。
 * @packageDocumentation
 */
import {
  onHand, summarize, needsReorder, reorderQuantity, onHandByWarehouse, expiringSoon, expiredLots,
  type StockMovement, type ReorderPolicy, type MovementSummary, type WarehouseMovement, type WarehouseStock, type LotMovement, type LotBalance,
} from "@platform/inventory";

/** 台帳の 1 行（倉庫・ロット・期限つき）。 */
export interface LedgerMovement extends StockMovement {
  warehouse?: string;
  lotId?: string;
  expiry?: string;
}

/** 商品マスタ。 */
export interface Product {
  sku: string;
  name: string;
  unit: string;
  policy?: ReorderPolicy;
}

/** 在庫状況（商品＋現在庫＋発注要否）。 */
export interface StockStatus {
  product: Product;
  summary: MovementSummary;
  needsReorder: boolean;
  suggestedOrderQty: number;
}

/** 商品ごとの詳細（台帳・倉庫別在庫・期限管理）。 */
export interface InventoryDetail {
  product: Product;
  movements: LedgerMovement[];
  byWarehouse: WarehouseStock[];
  expiringSoon: LotBalance[];
  expired: LotBalance[];
}

const DEFAULT_WAREHOUSE = "主倉庫";

/** 台帳を倉庫別在庫（欠損は主倉庫扱い）に集計する。 */
function warehouseBreakdown(movements: LedgerMovement[]): WarehouseStock[] {
  const wm: WarehouseMovement[] = movements.map((m) => ({ ...m, warehouse: m.warehouse ?? DEFAULT_WAREHOUSE }));
  return onHandByWarehouse(wm);
}

/** ロット付きの台帳だけを LotMovement に変換する。 */
function lotMovements(movements: LedgerMovement[]): LotMovement[] {
  return movements
    .filter((m) => m.lotId !== undefined)
    .map((m) => {
      const lm: LotMovement = { lotId: m.lotId!, type: m.type, quantity: m.quantity, at: m.at };
      if (m.expiry !== undefined) lm.expiry = m.expiry;
      return lm;
    });
}

/** 在庫ストア。 */
export interface InventoryStore {
  listProducts(): Promise<Product[]>;
  getProduct(sku: string): Promise<Product | undefined>;
  createProduct(product: Product): Promise<Product>;
  listMovements(sku: string): Promise<LedgerMovement[]>;
  recordMovement(sku: string, movement: LedgerMovement): Promise<void>;
  /** 全商品の在庫状況（発注が必要なものを含む）。 */
  status(): Promise<StockStatus[]>;
  /** 商品ごとの詳細（台帳・倉庫別・期限）。asOf を基準に期限を判定する。 */
  detail(sku: string, asOf?: string, expiryDays?: number): Promise<InventoryDetail | undefined>;
}

function toStatus(product: Product, movements: LedgerMovement[]): StockStatus {
  const summary = summarize(movements);
  const qty = onHand(movements);
  const reorder = product.policy ? needsReorder(qty, product.policy) : false;
  return { product, summary, needsReorder: reorder, suggestedOrderQty: product.policy ? reorderQuantity(qty, product.policy) : 0 };
}

function toDetail(product: Product, movements: LedgerMovement[], asOf: string, expiryDays: number): InventoryDetail {
  const lots = lotMovements(movements);
  return { product, movements, byWarehouse: warehouseBreakdown(movements), expiringSoon: expiringSoon(lots, asOf, expiryDays), expired: expiredLots(lots, asOf) };
}

/** インメモリ実装。 */
export function createMemoryInventoryStore(): InventoryStore {
  const products = new Map<string, Product>();
  const movements = new Map<string, LedgerMovement[]>();
  const sorted = (sku: string): LedgerMovement[] => (movements.get(sku) ?? []).slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return {
    async listProducts() {
      return [...products.values()];
    },
    async getProduct(sku) {
      return products.get(sku);
    },
    async createProduct(product) {
      products.set(product.sku, product);
      if (!movements.has(product.sku)) movements.set(product.sku, []);
      return product;
    },
    async listMovements(sku) {
      return sorted(sku);
    },
    async recordMovement(sku, movement) {
      const list = movements.get(sku) ?? [];
      list.push(movement);
      movements.set(sku, list);
    },
    async status() {
      return [...products.values()].map((p) => toStatus(p, movements.get(p.sku) ?? []));
    },
    async detail(sku, asOf = new Date().toISOString(), expiryDays = 30) {
      const product = products.get(sku);
      if (!product) return undefined;
      return toDetail(product, sorted(sku), asOf, expiryDays);
    },
  };
}

// ── Prisma 実装 ──

/** ProductRow の必要部分。 */
export interface ProductRow {
  sku: string;
  name: string;
  unit: string;
  safetyStock: number | null;
  dailyDemand: number | null;
  leadTimeDays: number | null;
  targetLevel: number | null;
}

/** StockMovementRow の必要部分。 */
export interface StockMovementRow {
  id: string;
  sku: string;
  type: string;
  quantity: number;
  at: Date;
  ref: string | null;
  unitCost: number | null;
  warehouse: string | null;
  lotId: string | null;
  expiry: string | null;
}

interface StockMovementRowData {
  sku: string;
  type: string;
  quantity: number;
  at: Date;
  ref: string | null;
  unitCost: number | null;
  warehouse: string | null;
  lotId: string | null;
  expiry: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface InventoryStoreDb {
  productRow: {
    findMany(args?: Record<string, never>): Promise<ProductRow[]>;
    findUnique(args: { where: { sku: string } }): Promise<ProductRow | null>;
    create(args: { data: ProductRow }): Promise<ProductRow>;
  };
  stockMovementRow: {
    findMany(args: { where: { sku: string }; orderBy: { at: "desc" } }): Promise<StockMovementRow[]>;
    create(args: { data: StockMovementRowData }): Promise<StockMovementRow>;
  };
}

function rowToProduct(row: ProductRow): Product {
  const product: Product = { sku: row.sku, name: row.name, unit: row.unit };
  if (row.safetyStock !== null && row.dailyDemand !== null && row.leadTimeDays !== null) {
    const policy: ReorderPolicy = { safetyStock: row.safetyStock, dailyDemand: row.dailyDemand, leadTimeDays: row.leadTimeDays };
    if (row.targetLevel !== null) policy.targetLevel = row.targetLevel;
    product.policy = policy;
  }
  return product;
}

function rowToMovement(row: StockMovementRow): LedgerMovement {
  const m: LedgerMovement = { type: row.type === "inbound" ? "inbound" : row.type === "outbound" ? "outbound" : "adjustment", quantity: row.quantity, at: row.at.toISOString() };
  if (row.ref) m.ref = row.ref;
  if (row.unitCost !== null) m.unitCost = row.unitCost;
  if (row.warehouse) m.warehouse = row.warehouse;
  if (row.lotId) m.lotId = row.lotId;
  if (row.expiry) m.expiry = row.expiry;
  return m;
}

/** Prisma 実装。 */
export function createPrismaInventoryStore(db: InventoryStoreDb): InventoryStore {
  const loadMovements = async (sku: string): Promise<LedgerMovement[]> =>
    (await db.stockMovementRow.findMany({ where: { sku }, orderBy: { at: "desc" } })).map(rowToMovement);
  return {
    async listProducts() {
      return (await db.productRow.findMany()).map(rowToProduct);
    },
    async getProduct(sku) {
      const row = await db.productRow.findUnique({ where: { sku } });
      return row ? rowToProduct(row) : undefined;
    },
    async createProduct(product) {
      await db.productRow.create({ data: { sku: product.sku, name: product.name, unit: product.unit, safetyStock: product.policy?.safetyStock ?? null, dailyDemand: product.policy?.dailyDemand ?? null, leadTimeDays: product.policy?.leadTimeDays ?? null, targetLevel: product.policy?.targetLevel ?? null } });
      return product;
    },
    async listMovements(sku) {
      return loadMovements(sku);
    },
    async recordMovement(sku, movement) {
      await db.stockMovementRow.create({ data: { sku, type: movement.type, quantity: movement.quantity, at: new Date(movement.at), ref: movement.ref ?? null, unitCost: movement.unitCost ?? null, warehouse: movement.warehouse ?? null, lotId: movement.lotId ?? null, expiry: movement.expiry ?? null } });
    },
    async status() {
      const products = (await db.productRow.findMany()).map(rowToProduct);
      const out: StockStatus[] = [];
      for (const p of products) out.push(toStatus(p, await loadMovements(p.sku)));
      return out;
    },
    async detail(sku, asOf = new Date().toISOString(), expiryDays = 30) {
      const row = await db.productRow.findUnique({ where: { sku } });
      if (!row) return undefined;
      return toDetail(rowToProduct(row), await loadMovements(sku), asOf, expiryDays);
    },
  };
}
