/**
 * 部品の初期化と配線(このファイルだけが「作り方」を知る)。
 * logger / mailer / 監査などを足す場合は internal-app の services.ts / platform-services.ts を参照。
 * @packageDocumentation
 */
import { createDb } from "@platform/db";
import { env, usePrisma } from "./env.js";
import { createMemoryItemStore, createPrismaItemStore, type ItemStore, type ItemStoreDb } from "./item-repo.js";

function prismaDb(): ItemStoreDb {
  if (!env.DATABASE_URL) throw new Error("PERSISTENCE=prisma には DATABASE_URL が必要です");
  return createDb(env.DATABASE_URL) as unknown as ItemStoreDb;
}

/** 品目ストア(PERSISTENCE=prisma で PostgreSQL、既定はインメモリ)。 */
export const itemStore: ItemStore = usePrisma ? createPrismaItemStore(prismaDb()) : createMemoryItemStore();
