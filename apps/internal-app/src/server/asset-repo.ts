/**
 * 固定資産リポジトリ。資産台帳を保持し、減価償却スケジュールと現在簿価を @platform/depreciation で算出する。
 * @packageDocumentation
 */
import { depreciationSchedule, bookValueAt, depreciationInYear, type DepreciationMethod, type ScheduleRow } from "@platform/depreciation";

/** 固定資産 1 件。 */
export interface FixedAsset {
  code: string;
  name: string;
  /** 取得日（YYYY-MM-DD）。 */
  acquiredOn: string;
  cost: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  /** 除却・売却日（YYYY-MM-DD）。未処分なら undefined。 */
  disposedOn?: string;
  /** 処分種別（除却 or 売却）。 */
  disposalType?: "retire" | "sell";
  /** 売却時の売却額。 */
  proceeds?: number;
}

/** 資産の現況（現在簿価・当年償却額つき）。 */
export interface AssetView extends FixedAsset {
  bookValue: number;
  currentYearDepreciation: number;
  accumulated: number;
  /** 指定年度時点で処分済みか。 */
  disposed: boolean;
}

/** 台帳サマリー。 */
export interface AssetSummary {
  totalCost: number;
  totalBookValue: number;
  totalAccumulated: number;
  count: number;
}

function acquiredYear(asset: FixedAsset): number {
  return Number(asset.acquiredOn.slice(0, 4));
}

/** 資産の償却スケジュール。 */
export function scheduleFor(asset: FixedAsset): ScheduleRow[] {
  return depreciationSchedule({ cost: asset.cost, usefulLifeYears: asset.usefulLifeYears, method: asset.method }, acquiredYear(asset));
}

/** 資産の現況（指定年度時点の簿価・当年償却額・累計。処分年度以降は簿価0）。 */
export function viewOf(asset: FixedAsset, asOfYear: number): AssetView {
  const schedule = scheduleFor(asset);
  const disposalYear = asset.disposedOn ? Number(asset.disposedOn.slice(0, 4)) : undefined;
  const disposed = disposalYear !== undefined && asOfYear >= disposalYear;
  if (disposed) return { ...asset, bookValue: 0, currentYearDepreciation: 0, accumulated: asset.cost, disposed: true };
  return { ...asset, bookValue: bookValueAt(schedule, asOfYear, asset.cost), currentYearDepreciation: depreciationInYear(schedule, asOfYear), accumulated: asset.cost - bookValueAt(schedule, asOfYear, asset.cost), disposed: false };
}

/** 台帳サマリーを集計する。 */
export function summarize(views: AssetView[]): AssetSummary {
  return {
    totalCost: views.reduce((s, a) => s + a.cost, 0),
    totalBookValue: views.reduce((s, a) => s + a.bookValue, 0),
    totalAccumulated: views.reduce((s, a) => s + a.accumulated, 0),
    count: views.length,
  };
}

/** 固定資産ストア。 */
export interface AssetStore {
  list(): Promise<FixedAsset[]>;
  get(code: string): Promise<FixedAsset | undefined>;
  upsert(asset: FixedAsset): Promise<FixedAsset>;
}

/** インメモリ実装。 */
export function createMemoryAssetStore(): AssetStore {
  const byCode = new Map<string, FixedAsset>();
  const order: string[] = [];
  return {
    async list() {
      return order.map((c) => byCode.get(c)!);
    },
    async get(code) {
      return byCode.get(code);
    },
    async upsert(asset) {
      if (!byCode.has(asset.code)) order.push(asset.code);
      byCode.set(asset.code, asset);
      return asset;
    },
  };
}

// ── Prisma 実装 ──

/** AssetRow の必要部分。 */
export interface AssetRow {
  code: string;
  name: string;
  acquiredOn: string;
  cost: number;
  usefulLifeYears: number;
  method: string;
  disposedOn: string | null;
  disposalType: string | null;
  proceeds: number | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AssetStoreDb {
  assetRow: {
    findMany(args: { orderBy: { acquiredOn: "asc" } }): Promise<AssetRow[]>;
    findUnique(args: { where: { code: string } }): Promise<AssetRow | null>;
    upsert(args: { where: { code: string }; create: AssetRow; update: { name: string; acquiredOn: string; cost: number; usefulLifeYears: number; method: string; disposedOn: string | null; disposalType: string | null; proceeds: number | null } }): Promise<AssetRow>;
  };
}

function normalizeMethod(v: string): DepreciationMethod {
  return v === "declining_balance" ? "declining_balance" : "straight_line";
}

function rowToAsset(row: AssetRow): FixedAsset {
  const asset: FixedAsset = { code: row.code, name: row.name, acquiredOn: row.acquiredOn, cost: row.cost, usefulLifeYears: row.usefulLifeYears, method: normalizeMethod(row.method) };
  if (row.disposedOn) asset.disposedOn = row.disposedOn;
  if (row.disposalType === "retire" || row.disposalType === "sell") asset.disposalType = row.disposalType;
  if (row.proceeds !== null) asset.proceeds = row.proceeds;
  return asset;
}

/** Prisma 実装。 */
export function createPrismaAssetStore(db: AssetStoreDb): AssetStore {
  return {
    async list() {
      return (await db.assetRow.findMany({ orderBy: { acquiredOn: "asc" } })).map(rowToAsset);
    },
    async get(code) {
      const row = await db.assetRow.findUnique({ where: { code } });
      return row ? rowToAsset(row) : undefined;
    },
    async upsert(asset) {
      const data: AssetRow = { code: asset.code, name: asset.name, acquiredOn: asset.acquiredOn, cost: asset.cost, usefulLifeYears: asset.usefulLifeYears, method: asset.method, disposedOn: asset.disposedOn ?? null, disposalType: asset.disposalType ?? null, proceeds: asset.proceeds ?? null };
      await db.assetRow.upsert({ where: { code: asset.code }, create: data, update: { name: data.name, acquiredOn: data.acquiredOn, cost: data.cost, usefulLifeYears: data.usefulLifeYears, method: data.method, disposedOn: data.disposedOn, disposalType: data.disposalType, proceeds: data.proceeds } });
      return asset;
    },
  };
}
