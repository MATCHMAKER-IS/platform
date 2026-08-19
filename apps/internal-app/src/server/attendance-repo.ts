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

/**
 * AttendanceRow の必要部分。
 *
 * **`date` は DB では `Date`(時刻無し)。** `@platform/attendance` の
 * 公開契約(`AttendanceEntry.date: string`)は変えない——この境界
 * (`rowToEntry` / `toDateOnly`)で変換する(2026-08、DB 層のみ移行)。
 */
export interface AttendanceRow {
  id: string;
  userId: string;
  date: Date;
  clockIn: string;
  clockOut: string;
  breakMinutes: number | null;
  isHoliday: boolean;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AttendanceStoreDb {
  attendanceRow: {
    findMany(args: { where: { userId: string; date?: { gte: Date; lt: Date } }; orderBy: { date: "asc" }; take: number }): Promise<AttendanceRow[]>;
    findFirst(args: { where: { userId: string; date: Date } }): Promise<AttendanceRow | null>;
    create(args: { data: { userId: string; date: Date; clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean } }): Promise<AttendanceRow>;
    update(args: { where: { id: string }; data: { clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean } }): Promise<AttendanceRow>;
    upsert(args: {
      where: { userId_date: { userId: string; date: Date } };
      create: { userId: string; date: Date; clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean };
      update: { clockIn: string; clockOut: string; breakMinutes: number | null; isHoliday: boolean };
    }): Promise<AttendanceRow>;
  };
}

/** "YYYY-MM-DD" → UTC 深夜 0 時の Date(`@db.Date` へ渡す形)。 */
function toDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Date → "YYYY-MM-DD"(`@platform/attendance` の契約どおり string で返す)。 */
function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM"(月)→ その月の [開始, 翌月開始) の範囲。`gte`/`lt` の範囲検索に使う。 */
function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split("-").map(Number);
  const gte = new Date(Date.UTC(y!, m! - 1, 1));
  const lt = new Date(Date.UTC(y!, m!, 1));
  return { gte, lt };
}

function rowToEntry(row: AttendanceRow): AttendanceEntry {
  const e: AttendanceEntry = { date: fromDateOnly(row.date), clockIn: row.clockIn, clockOut: row.clockOut, isHoliday: row.isHoliday };
  if (row.breakMinutes !== null) e.breakMinutes = row.breakMinutes;
  return e;
}

/** Prisma 実装。 */
export function createPrismaAttendanceStore(db: AttendanceStoreDb): AttendanceStore {
  return {
    async list(userId) {
      // **上限を付ける。** その人の**全期間**を返すので、
      // **年 250 件 × 勤続年数**になります——5 年で 1,250 件。
      // **画面に出すのは直近だけ**なので、400 件(約 1.5 年分)で足ります。
      //
      // **それ以上が要るなら、期間で絞って**ください(`listMonth`)
      // ——「全部見せる」画面は、**そもそも人が読めません**。
      return (await db.attendanceRow.findMany({ where: { userId }, take: 400, orderBy: { date: "asc" } })).map(rowToEntry);
    },
    async record(userId, entry) {
      const data = { clockIn: entry.clockIn, clockOut: entry.clockOut, breakMinutes: entry.breakMinutes ?? null, isHoliday: entry.isHoliday ?? false };
      const date = toDateOnly(entry.date);
      // **`upsert` で 1 回にまとめる。**
      // 「読んで → 無ければ作る」は、同時に押されると両方が「無い」と判断して
      // 二重に入る。DB の一意制約(`@@unique([userId, date])`)と
      // 組み合わせて初めて防げる(2026-08)
      await db.attendanceRow.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, ...data },
        update: data,
      });
      return toDay(entry);
    },
    async monthly(userId, month) {
      // **`startsWith` は文字列専用。** `Date` 型になったので範囲検索
      // (`gte`/`lt`)に置き換える(2026-08、date が DateTime になった際に対応)。
      const entries = (await db.attendanceRow.findMany({ where: { userId, date: monthRange(month) }, orderBy: { date: "asc" }, take: 40 })).map(rowToEntry);
      return summarize(month, entries);
    },
  };
}
