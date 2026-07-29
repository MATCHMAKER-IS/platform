/**
 * 残高の記録の保存先。
 *
 * 開発ではメモリ、本番は PostgreSQL。**同じ形（ポート）で切り替えます**。
 * @packageDocumentation
 */
import type { BalanceSnapshot } from "@platform/freee";

/** 保存先。アプリが memory / prisma のどちらかで実装する。 */
export interface SnapshotStore {
  /** 記録を足す（同じ時刻の重複は無視する）。 */
  add(snapshots: BalanceSnapshot[]): Promise<number>;
  /** 期間の記録を取る（日付昇順）。 */
  list(from: string, to: string): Promise<BalanceSnapshot[]>;
  /** すべて取る（間引きの判断に使う）。 */
  all(): Promise<BalanceSnapshot[]>;
  /** 指定した時刻の記録を消す。 */
  removeMany(takenAts: string[]): Promise<number>;
  /** 件数（画面に出す）。 */
  count(): Promise<number>;
}

/**
 * メモリ実装（開発・テスト用）。
 *
 * **本番では使わないこと。** 再起動で消えると、月末の記録も失われます。
 *
 * @returns メモリ上の保存先
 */
export function createMemorySnapshotStore(): SnapshotStore {
  const rows = new Map<string, BalanceSnapshot>();
  const key = (s: BalanceSnapshot) => `${s.walletableId}:${s.takenAt}`;

  return {
    async add(snapshots) {
      let added = 0;
      for (const s of snapshots) {
        if (rows.has(key(s))) continue;   // 同じ時刻の重複は入れない
        rows.set(key(s), s);
        added += 1;
      }
      return added;
    },
    async list(from, to) {
      return [...rows.values()]
        .filter((s) => s.takenAt.slice(0, 10) >= from && s.takenAt.slice(0, 10) <= to)
        .sort((a, b) => (a.takenAt < b.takenAt ? -1 : 1));
    },
    async all() {
      return [...rows.values()].sort((a, b) => (a.takenAt < b.takenAt ? -1 : 1));
    },
    async removeMany(takenAts) {
      const set = new Set(takenAts);
      let n = 0;
      for (const [k, v] of rows) {
        if (set.has(v.takenAt)) { rows.delete(k); n += 1; }
      }
      return n;
    },
    async count() {
      return rows.size;
    },
  };
}

/** Prisma の必要部分（型だけを借りる）。 */
export interface SnapshotDb {
  balanceSnapshot: {
    createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
    findMany(args?: unknown): Promise<Record<string, unknown>[]>;
    deleteMany(args: { where: unknown }): Promise<{ count: number }>;
    count(): Promise<number>;
  };
}

/**
 * PostgreSQL 実装。
 *
 * @param db Prisma クライアント
 * @returns 保存先
 */
export function createPrismaSnapshotStore(db: SnapshotDb): SnapshotStore {
  const toSnapshot = (r: Record<string, unknown>): BalanceSnapshot => ({
    walletableId: Number(r.walletableId),
    walletableName: String(r.walletableName ?? ""),
    balance: Number(r.balance),
    takenAt: (r.takenAt as Date).toISOString(),
  });

  return {
    async add(snapshots) {
      const r = await db.balanceSnapshot.createMany({
        data: snapshots.map((s) => ({
          walletableId: s.walletableId,
          walletableName: s.walletableName ?? "",
          walletableType: "bank_account",
          balance: Math.round(s.balance),
          takenAt: new Date(s.takenAt),
          takenOn: s.takenAt.slice(0, 10),
        })),
        // 同じ時刻を二重に入れない
        skipDuplicates: true,
      });
      return r.count;
    },
    async list(from, to) {
      const rows = await db.balanceSnapshot.findMany({
        where: { takenOn: { gte: from, lte: to } },
        orderBy: { takenAt: "asc" },
      });
      return rows.map(toSnapshot);
    },
    async all() {
      const rows = await db.balanceSnapshot.findMany({ orderBy: { takenAt: "asc" } });
      return rows.map(toSnapshot);
    },
    async removeMany(takenAts) {
      const r = await db.balanceSnapshot.deleteMany({
        where: { takenAt: { in: takenAts.map((t) => new Date(t)) } },
      });
      return r.count;
    },
    async count() {
      return db.balanceSnapshot.count();
    },
  };
}
