/**
 * レポートのプリセット。よく使う絞り込み条件（レポート種別・期間・取引先）を名前付きで保存し、再利用する。純ロジック＋ストア。
 * @packageDocumentation
 */

/** レポート種別。 */
export type PresetReportType = "sales" | "receivables" | "inventory";

/** プリセット。 */
export interface ReportPreset {
  id: string;
  name: string;
  reportType: PresetReportType;
  from?: string;
  to?: string;
  partner?: string;
}

/** プリセットからレポート URL のクエリ文字列を組み立てる。 */
export function presetToQuery(preset: ReportPreset, format = "html"): string {
  const params = [`format=${format}`];
  if (preset.from) params.push(`from=${preset.from}`);
  if (preset.to) params.push(`to=${preset.to}`);
  if (preset.partner) params.push(`partner=${encodeURIComponent(preset.partner)}`);
  return `/api/reports/${preset.reportType}?${params.join("&")}`;
}

/** プリセットストア（利用者ごと）。 */
export interface ReportPresetStore {
  list(owner: string): Promise<ReportPreset[]>;
  add(owner: string, preset: Omit<ReportPreset, "id">): Promise<ReportPreset>;
  remove(owner: string, id: string): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryReportPresetStore(): ReportPresetStore {
  const byOwner = new Map<string, ReportPreset[]>();
  let seq = 0;
  return {
    async list(owner) {
      return (byOwner.get(owner) ?? []).map((p) => ({ ...p }));
    },
    async add(owner, preset) {
      const p: ReportPreset = { id: `rp${seq++}`, ...preset };
      const arr = byOwner.get(owner) ?? [];
      arr.push(p);
      byOwner.set(owner, arr);
      return { ...p };
    },
    async remove(owner, id) {
      const arr = byOwner.get(owner);
      if (!arr) return;
      const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr.splice(i, 1);
    },
  };
}

// ── Prisma 実装 ──

/** ReportPresetRow の必要部分。 */
export interface ReportPresetRow {
  id: string;
  owner: string;
  name: string;
  reportType: string;
  fromDate: string | null;
  toDate: string | null;
  partner: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReportPresetStoreDb {
  reportPresetRow: {
    findMany(args: { where: { owner: string }; orderBy: { name: "asc" } }): Promise<ReportPresetRow[]>;
    create(args: { data: { owner: string; name: string; reportType: string; fromDate: string | null; toDate: string | null; partner: string | null } }): Promise<ReportPresetRow>;
    deleteMany(args: { where: { id: string; owner: string } }): Promise<{ count: number }>;
  };
}

const row = (r: ReportPresetRow): ReportPreset => ({ id: r.id, name: r.name, reportType: r.reportType as PresetReportType, ...(r.fromDate ? { from: r.fromDate } : {}), ...(r.toDate ? { to: r.toDate } : {}), ...(r.partner ? { partner: r.partner } : {}) });

/** Prisma 実装。 */
export function createPrismaReportPresetStore(db: ReportPresetStoreDb): ReportPresetStore {
  return {
    async list(owner) {
      return (await db.reportPresetRow.findMany({ where: { owner }, orderBy: { name: "asc" } })).map(row);
    },
    async add(owner, preset) {
      return row(await db.reportPresetRow.create({ data: { owner, name: preset.name, reportType: preset.reportType, fromDate: preset.from ?? null, toDate: preset.to ?? null, partner: preset.partner ?? null } }));
    },
    async remove(owner, id) {
      await db.reportPresetRow.deleteMany({ where: { id, owner } });
    },
  };
}
