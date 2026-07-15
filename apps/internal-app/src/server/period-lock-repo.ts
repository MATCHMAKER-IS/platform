/**
 * 月次締めロック。締めた月（YYYY-MM）を記録し、その月に属する伝票の追加・変更を禁止する（内部統制）。
 * @packageDocumentation
 */

/** ロックされた会計期間。 */
export interface PeriodLock {
  period: string;
  lockedAt: string;
  lockedBy: string;
}

/** 日付（YYYY-MM-DD 等）が、ロック済み期間の集合に属するか。 */
export function isDateLocked(date: string, lockedPeriods: Set<string>): boolean {
  return lockedPeriods.has(date.slice(0, 7));
}

/** ロック期間ストア。 */
export interface PeriodLockStore {
  list(): Promise<PeriodLock[]>;
  lockedSet(): Promise<Set<string>>;
  lock(period: string, by: string): Promise<PeriodLock>;
  unlock(period: string): Promise<void>;
}

/** インメモリ実装。 */
export function createMemoryPeriodLockStore(): PeriodLockStore {
  const byPeriod = new Map<string, PeriodLock>();
  return {
    async list() {
      return [...byPeriod.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
    },
    async lockedSet() {
      return new Set(byPeriod.keys());
    },
    async lock(period, by) {
      const lock: PeriodLock = { period, lockedAt: new Date().toISOString(), lockedBy: by };
      byPeriod.set(period, lock);
      return lock;
    },
    async unlock(period) {
      byPeriod.delete(period);
    },
  };
}

// ── Prisma 実装 ──

/** PeriodLockRow の必要部分。 */
export interface PeriodLockRow {
  period: string;
  lockedAt: string;
  lockedBy: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PeriodLockStoreDb {
  periodLockRow: {
    findMany(args: { orderBy: { period: "asc" } }): Promise<PeriodLockRow[]>;
    upsert(args: { where: { period: string }; create: PeriodLockRow; update: { lockedAt: string; lockedBy: string } }): Promise<PeriodLockRow>;
    delete(args: { where: { period: string } }): Promise<unknown>;
  };
}

/** Prisma 実装。 */
export function createPrismaPeriodLockStore(db: PeriodLockStoreDb): PeriodLockStore {
  return {
    async list() {
      return (await db.periodLockRow.findMany({ orderBy: { period: "asc" } })).map((r) => ({ period: r.period, lockedAt: r.lockedAt, lockedBy: r.lockedBy }));
    },
    async lockedSet() {
      return new Set((await db.periodLockRow.findMany({ orderBy: { period: "asc" } })).map((r) => r.period));
    },
    async lock(period, by) {
      const lockedAt = new Date().toISOString();
      await db.periodLockRow.upsert({ where: { period }, create: { period, lockedAt, lockedBy: by }, update: { lockedAt, lockedBy: by } });
      return { period, lockedAt, lockedBy: by };
    },
    async unlock(period) {
      await db.periodLockRow.delete({ where: { period } });
    },
  };
}
