/**
 * 部品の初期化と配線（このファイルだけが「作り方」を知る）。
 * @packageDocumentation
 */
import { createDb } from "@platform/db";
import { env } from "./env";
import {
  createMemorySnapshotStore, createPrismaSnapshotStore,
  type SnapshotStore, type SnapshotDb,
} from "./snapshot-repo";

/** DB を使うか。**未設定ならメモリ**（開発では繋がなくても動く）。 */
export const usePrisma = Boolean(env.DATABASE_URL);

function prismaDb(): SnapshotDb {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL が必要です");
  return createDb(env.DATABASE_URL) as unknown as SnapshotDb;
}

/**
 * 残高の記録の保存先。
 *
 * **本番では必ず DATABASE_URL を設定すること。** メモリのままだと
 * 再起動で月末の記録まで消えます。
 */
export const snapshotStore: SnapshotStore = usePrisma
  ? createPrismaSnapshotStore(prismaDb())
  : createMemorySnapshotStore();
