/**
 * エクスポートのスケジュール実行。バックアップ/CSV エクスポートを定期実行し、実行履歴を残す。純ロジック＋ストア。
 * @packageDocumentation
 */

/** エクスポート種別。 */
export type ExportType = "backup" | "partners" | "invoices" | "audit";

/** 実行頻度。 */
export type ExportFrequency = "daily" | "weekly" | "monthly";

/** スケジュール定義。 */
export interface ExportSchedule {
  id: string;
  type: ExportType;
  frequency: ExportFrequency;
  enabled: boolean;
  lastRunAt?: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** スケジュールが実行時期に来ているか（有効かつ前回から間隔を超過）。 */
export function isExportDue(schedule: ExportSchedule, now: Date): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.lastRunAt) return true;
  const elapsed = now.getTime() - new Date(schedule.lastRunAt).getTime();
  const interval = schedule.frequency === "daily" ? DAY : schedule.frequency === "weekly" ? 7 * DAY : 30 * DAY;
  return elapsed >= interval;
}

/** 実行すべきスケジュールを選ぶ。 */
export function dueSchedules(schedules: ExportSchedule[], now: Date): ExportSchedule[] {
  return schedules.filter((s) => isExportDue(s, now));
}

/** 実行履歴の 1 件。 */
export interface ExportRun {
  id: string;
  type: ExportType;
  at: string;
  status: "success" | "failed";
  recordCount: number;
  note?: string;
}

/** スケジュールストア。 */
export interface ExportScheduleStore {
  list(): Promise<ExportSchedule[]>;
  add(type: ExportType, frequency: ExportFrequency): Promise<ExportSchedule>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  markRun(id: string, at: string): Promise<void>;
  remove(id: string): Promise<void>;
}

/** 履歴ストア。 */
export interface ExportRunStore {
  list(limit?: number): Promise<ExportRun[]>;
  add(run: Omit<ExportRun, "id">): Promise<ExportRun>;
}

/** インメモリのスケジュールストア。 */
export function createMemoryExportScheduleStore(): ExportScheduleStore {
  const items: ExportSchedule[] = [];
  let sSeq = 0;
  return {
    async list() {
      return items.map((s) => ({ ...s }));
    },
    async add(type, frequency) {
      const s: ExportSchedule = { id: `es${sSeq++}`, type, frequency, enabled: true };
      items.push(s);
      return { ...s };
    },
    async setEnabled(id, enabled) {
      const s = items.find((x) => x.id === id);
      if (s) s.enabled = enabled;
    },
    async markRun(id, at) {
      const s = items.find((x) => x.id === id);
      if (s) s.lastRunAt = at;
    },
    async remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

/** インメモリの履歴ストア。 */
export function createMemoryExportRunStore(): ExportRunStore {
  const runs: ExportRun[] = [];
  let rSeq = 0;
  return {
    async list(limit = 50) {
      return runs.slice(0, limit).map((r) => ({ ...r }));
    },
    async add(run) {
      const r: ExportRun = { id: `er${rSeq++}`, ...run };
      runs.unshift(r); // 新しい順
      return { ...r };
    },
  };
}

// ── Prisma 実装 ──

/** ExportScheduleRow の必要部分。 */
export interface ExportScheduleRow {
  id: string;
  type: string;
  frequency: string;
  enabled: boolean;
  lastRunAt: string | null;
}

/** ExportRunRow の必要部分。 */
export interface ExportRunRow {
  id: string;
  type: string;
  at: string;
  status: string;
  recordCount: number;
  note: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ExportScheduleStoreDb {
  exportScheduleRow: {
    findMany(args: { orderBy: { type: "asc" } }): Promise<ExportScheduleRow[]>;
    create(args: { data: { type: string; frequency: string; enabled: boolean; lastRunAt: string | null } }): Promise<ExportScheduleRow>;
    update(args: { where: { id: string }; data: Partial<{ enabled: boolean; lastRunAt: string }> }): Promise<ExportScheduleRow>;
    delete(args: { where: { id: string } }): Promise<ExportScheduleRow>;
  };
}

/** 使用する Prisma デリゲートの最小ポート（履歴）。 */
export interface ExportRunStoreDb {
  exportRunRow: {
    findMany(args: { orderBy: { at: "desc" }; take: number }): Promise<ExportRunRow[]>;
    create(args: { data: { type: string; at: string; status: string; recordCount: number; note: string | null } }): Promise<ExportRunRow>;
  };
}

const sRow = (r: ExportScheduleRow): ExportSchedule => ({ id: r.id, type: r.type as ExportType, frequency: r.frequency as ExportFrequency, enabled: r.enabled, ...(r.lastRunAt ? { lastRunAt: r.lastRunAt } : {}) });

/** Prisma スケジュールストア。 */
export function createPrismaExportScheduleStore(db: ExportScheduleStoreDb): ExportScheduleStore {
  return {
    async list() {
      return (await db.exportScheduleRow.findMany({ orderBy: { type: "asc" } })).map(sRow);
    },
    async add(type, frequency) {
      return sRow(await db.exportScheduleRow.create({ data: { type, frequency, enabled: true, lastRunAt: null } }));
    },
    async setEnabled(id, enabled) {
      await db.exportScheduleRow.update({ where: { id }, data: { enabled } });
    },
    async markRun(id, at) {
      await db.exportScheduleRow.update({ where: { id }, data: { lastRunAt: at } });
    },
    async remove(id) {
      await db.exportScheduleRow.delete({ where: { id } });
    },
  };
}

/** Prisma 履歴ストア。 */
export function createPrismaExportRunStore(db: ExportRunStoreDb): ExportRunStore {
  return {
    async list(limit = 50) {
      return (await db.exportRunRow.findMany({ orderBy: { at: "desc" }, take: limit })).map((r) => ({ id: r.id, type: r.type as ExportType, at: r.at, status: r.status as "success" | "failed", recordCount: r.recordCount, ...(r.note ? { note: r.note } : {}) }));
    },
    async add(run) {
      const r = await db.exportRunRow.create({ data: { type: run.type, at: run.at, status: run.status, recordCount: run.recordCount, note: run.note ?? null } });
      return { id: r.id, type: r.type as ExportType, at: r.at, status: r.status as "success" | "failed", recordCount: r.recordCount, ...(r.note ? { note: r.note } : {}) };
    },
  };
}
