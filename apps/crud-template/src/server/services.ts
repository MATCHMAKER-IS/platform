/**
 * 部品の初期化と配線(このファイルだけが「作り方」を知る)。
 * logger / mailer / 監査などを足す場合は internal-app の services.ts / platform-services.ts を参照。
 * @packageDocumentation
 */
import { createDb } from "@platform/db";
import { PrismaClient } from "../generated/prisma";
import { env, usePrisma } from "./env";
import { createMemoryItemStore, createPrismaItemStore, type ItemStore, type ItemStoreDb } from "./item-repo";

function prismaDb(): ItemStoreDb {
  return createDb((o) => new PrismaClient(o), env.DATABASE_URL) as unknown as ItemStoreDb;
}

/**
 * 品目ストア。**既定は PostgreSQL。**
 *
 * `PERSISTENCE=memory` のときだけメモリ実装になる(再起動で消えるので、
 * 開発の使い捨て以外には向かない)。
 */
export const itemStore: ItemStore = usePrisma ? createPrismaItemStore(prismaDb()) : createMemoryItemStore();
