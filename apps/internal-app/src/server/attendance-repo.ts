/**
 * 勤怠リポジトリ(このアプリの保存先)。
 * 型と集計ロジックは @platform/attendance にあり、ここは Prisma 実装だけを持つ。
 * @packageDocumentation
 */
// 勤怠の型と計算は基盤に一本化した(ADR 0015: 同じ機能を 2 か所に持たない)。
// ここに残すのは、このアプリ固有の保存先(Prisma 実装)だけ。
import {
  toDay, summarize,
  type AttendanceEntry, type AttendanceDay, type AttendanceSummary, type AttendanceStore,
} from "@platform/attendance";

export type { AttendanceEntry, AttendanceDay, AttendanceSummary, AttendanceStore };

// メモリ実装は基盤のものを使う
export { createMemoryAttendanceStore } from "@platform/attendance";

// ── Prisma 実装 ──

/** AttendanceRow の必要部分。 */
export interface AttendanceRow {
  id: string;
  userId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number | null;
  isHoliday: boolean;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AttendanceStoreDb {
  attendanceRow: {
    findMany(args: { where: { userId: string; date?: { startsWith: string } }; orderBy: { date: "asc" } }): Promise<AttendanceRow[]>;
    findFirst(args: { where: { userId: string; date: string } }): Promise<AttendanceRow | null>;
    create(args: { data: { userId: string; date: string; clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean } }): Promise<AttendanceRow>;
    update(args: { where: { id: string }; data: { clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean } }): Promise<AttendanceRow>;
  };
}

function rowToEntry(row: AttendanceRow): AttendanceEntry {
  const e: AttendanceEntry = { date: row.date, clockIn: row.clockIn, clockOut: row.clockOut, isHoliday: row.isHoliday };
  if (row.breakMinutes !== null) e.breakMinutes = row.breakMinutes;
  return e;
}

/** Prisma 実装。 */
export function createPrismaAttendanceStore(db: AttendanceStoreDb): AttendanceStore {
  return {
    async list(userId) {
      return (await db.attendanceRow.findMany({ where: { userId }, orderBy: { date: "asc" } })).map(rowToEntry);
    },
    async record(userId, entry) {
      const existing = await db.attendanceRow.findFirst({ where: { userId, date: entry.date } });
      const data = { clockIn: entry.clockIn, clockOut: entry.clockOut, breakMinutes: entry.breakMinutes ?? null, isHoliday: entry.isHoliday ?? false };
      if (existing) await db.attendanceRow.update({ where: { id: existing.id }, data });
      else await db.attendanceRow.create({ data: { userId, date: entry.date, ...data } });
      return toDay(entry);
    },
    async monthly(userId, month) {
      const entries = (await db.attendanceRow.findMany({ where: { userId, date: { startsWith: month } }, orderBy: { date: "asc" } })).map(rowToEntry);
      return summarize(month, entries);
    },
  };
}
