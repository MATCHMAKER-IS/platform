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
  /** DB では `Date`。`JournalEntry`(`@platform/accounting`)の公開契約
   *  (`date: string`)は変えない——`rowToManual` の境界で変換する(2026-08)。 */
  date: Date;
  description: string;
  lines: unknown;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ManualJournalStoreDb {
  manualJournalRow: {
    createMany(args: { data: unknown[] }): Promise<unknown>;
    findMany(args: { take: number; orderBy: { date: "asc" | "desc" } }): Promise<ManualJournalRow[]>;
    create(args: { data: { date: Date; description: string; lines: unknown } }): Promise<ManualJournalRow>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
}

function rowToManual(row: ManualJournalRow): ManualJournal {
  return { id: row.id, entry: { date: row.date.toISOString(), description: row.description, lines: Array.isArray(row.lines) ? (row.lines as JournalEntry["lines"]) : [] } };
}

/** Prisma 実装。 */
export function createPrismaManualJournalStore(db: ManualJournalStoreDb): ManualJournalStore {
  return {
    async list(year) {
      // **上限を付ける。** **絞りが無く全件を返して**いました——
      // 手動仕訳は**年に数百件**、5 年で 2,500 件になります。
      //
      // **並び順も `desc` に変えました。** 上限で切るなら
      // **新しい方から取らないと、古い 500 件だけが見える**ことになります
      // ——「最近入れた仕訳が出ない」という形で現れます。
      return (await db.manualJournalRow.findMany({ take: 500, orderBy: { date: "desc" } })).map(rowToManual).filter((m) => inYear(m.entry, year));
    },
    async entries(year) {
      return (await db.manualJournalRow.findMany({ take: 500, orderBy: { date: "desc" } })).map(rowToManual).filter((m) => inYear(m.entry, year)).map((m) => m.entry);
    },
    async add(entries) {
      // **1 件ずつ作らない。**
      // CSV の取り込みは数百件になることがあり、
      // その数だけ問い合わせが飛ぶ
      if (entries.length === 0) return 0;
      await db.manualJournalRow.createMany({
        data: entries.map((entry) => ({
          // **`entry.date` は文字列(公開契約)のまま受け取る。** DB へ書く
          // 直前だけ Date に変換する(2026-08、date を DateTime に移行)。
          date: new Date(entry.date), description: entry.description, lines: entry.lines,
        })),
      });
      return entries.length;
    },
    async remove(id) {
      await db.manualJournalRow.delete({ where: { id } });
    },
  };
}
