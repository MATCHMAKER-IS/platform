/**
 * 勤怠リポジトリ。出退勤から実労働・時間外・深夜・法定休日の各区分を @platform/payroll に委譲して集計する。
 * @packageDocumentation
 */
import { splitDailyWork, parseTimeToMinutes } from "@platform/payroll";

/** 1 日の打刻。 */
export interface AttendanceEntry {
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes?: number;
  isHoliday?: boolean;
}

/** 集計済みの 1 日。 */
export interface AttendanceDay extends AttendanceEntry {
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
}

/** 月次サマリー。 */
export interface AttendanceSummary {
  month: string;
  days: AttendanceDay[];
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
}

function toDay(entry: AttendanceEntry): AttendanceDay {
  const startMin = parseTimeToMinutes(entry.clockIn);
  let endMin = parseTimeToMinutes(entry.clockOut);
  if (endMin <= startMin) endMin += 1440; // 日をまたぐ勤務
  const split = splitDailyWork({ startMin, endMin, breakMinutes: entry.breakMinutes ?? 0, isHoliday: entry.isHoliday ?? false });
  return { ...entry, totalMinutes: split.totalMinutes, overtimeMinutes: split.overtimeMinutes, nightMinutes: split.nightMinutes, holidayMinutes: split.holidayMinutes };
}

function summarize(month: string, entries: AttendanceEntry[]): AttendanceSummary {
  const days = entries.map(toDay).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    month,
    days,
    totalMinutes: days.reduce((s, d) => s + d.totalMinutes, 0),
    overtimeMinutes: days.reduce((s, d) => s + d.overtimeMinutes, 0),
    nightMinutes: days.reduce((s, d) => s + d.nightMinutes, 0),
    holidayMinutes: days.reduce((s, d) => s + d.holidayMinutes, 0),
  };
}

/** 勤怠ストア。 */
export interface AttendanceStore {
  list(userId: string): Promise<AttendanceEntry[]>;
  record(userId: string, entry: AttendanceEntry): Promise<AttendanceDay>;
  /** 月次集計（month は "YYYY-MM"）。 */
  monthly(userId: string, month: string): Promise<AttendanceSummary>;
}

/** インメモリ実装。 */
export function createMemoryAttendanceStore(): AttendanceStore {
  const byUser = new Map<string, AttendanceEntry[]>();
  return {
    async list(userId) {
      return (byUser.get(userId) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },
    async record(userId, entry) {
      const list = byUser.get(userId) ?? [];
      const idx = list.findIndex((e) => e.date === entry.date);
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      byUser.set(userId, list);
      return toDay(entry);
    },
    async monthly(userId, month) {
      const entries = (byUser.get(userId) ?? []).filter((e) => e.date.startsWith(month));
      return summarize(month, entries);
    },
  };
}

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
