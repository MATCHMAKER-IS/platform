/** 部品の初期化と配線(crud-template と同パターン)。 */
import { createDb } from "@platform/db";
import { env, usePrisma } from "./env";
import { createMemoryEquipmentStore, createPrismaEquipmentStore, type EquipmentStore, type EquipmentStoreDb } from "./equipment-repo";

function prismaDb(): EquipmentStoreDb {
  if (!env.DATABASE_URL) throw new Error("PERSISTENCE=prisma には DATABASE_URL が必要です");
  return createDb(env.DATABASE_URL) as unknown as EquipmentStoreDb;
}

/** 備品ストア(PERSISTENCE=prisma で PostgreSQL、既定はインメモリ)。 */
export const equipmentStore: EquipmentStore = usePrisma ? createPrismaEquipmentStore(prismaDb()) : createMemoryEquipmentStore();
