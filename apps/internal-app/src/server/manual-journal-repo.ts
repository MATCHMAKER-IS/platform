/**
 * 手動仕訳（決算整理・調整仕訳）リポジトリ。CSV 取り込みや手入力で登録した仕訳を保持し、
 * 自動生成の仕訳とあわせて決算・元帳に反映する。
 * @packageDocumentation
 */
import { type JournalEntry } from "@platform/accounting";

/** 保存された手動仕訳（id つき）。 */
export interface ManualJournal {
  id: string;
  entry: JournalEntry;
}

/** 手動仕訳ストア。 */
export interface ManualJournalStore {
  list(year?: number): Promise<ManualJournal[]>;
  entries(year?: number): Promise<JournalEntry[]>;
  add(entries: JournalEntry[]): Promise<number>;
  remove(id: string): Promise<void>;
}

const inYear = (entry: JournalEntry, year?: number): boolean => year === undefined || entry.date.startsWith(String(year));

let memSeq = 0;

/** インメモリ実装。 */
export function createMemoryManualJournalStore(): ManualJournalStore {
  const items: ManualJournal[] = [];
  return {
    async list(year) {
      return items.filter((m) => inYear(m.entry, year));
    },
    async entries(year) {
      return items.filter((m) => inYear(m.entry, year)).map((m) => m.entry);
    },
    async add(entries) {
      for (const entry of entries) items.push({ id: `j${memSeq++}`, entry });
      return entries.length;
    },
    async remove(id) {
      const i = items.findIndex((m) => m.id === id);
      if (i >= 0) items.splice(i, 1);
    },
  };
}

// ── Prisma 実装 ──

/** ManualJournalRow の必要部分（明細は JSON）。 */
export interface ManualJournalRow {
  id: string;
  date: string;
  description: string;
  lines: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ManualJournalStoreDb {
  manualJournalRow: {
    findMany(args: { orderBy: { date: "asc" } }): Promise<ManualJournalRow[]>;
    create(args: { data: { date: string; description: string; lines: unknown } }): Promise<ManualJournalRow>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
}

function rowToManual(row: ManualJournalRow): ManualJournal {
  return { id: row.id, entry: { date: row.date, description: row.description, lines: Array.isArray(row.lines) ? (row.lines as JournalEntry["lines"]) : [] } };
}

/** Prisma 実装。 */
export function createPrismaManualJournalStore(db: ManualJournalStoreDb): ManualJournalStore {
  return {
    async list(year) {
      return (await db.manualJournalRow.findMany({ orderBy: { date: "asc" } })).map(rowToManual).filter((m) => inYear(m.entry, year));
    },
    async entries(year) {
      return (await db.manualJournalRow.findMany({ orderBy: { date: "asc" } })).map(rowToManual).filter((m) => inYear(m.entry, year)).map((m) => m.entry);
    },
    async add(entries) {
      for (const entry of entries) await db.manualJournalRow.create({ data: { date: entry.date, description: entry.description, lines: entry.lines } });
      return entries.length;
    },
    async remove(id) {
      await db.manualJournalRow.delete({ where: { id } });
    },
  };
}
