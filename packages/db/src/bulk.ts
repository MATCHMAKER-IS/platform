/**
 * 一括インポート(バルク処理)。
 * - {@link bulkInsert}: 高速。チャンク分割 createMany。ID は返らない。
 * - {@link bulkInsertReturning}: トランザクション内で 1 件ずつ作成し、生成 ID を含む
 *   レコードを返す(挿入後の ID 取得)。全件成功か全件失敗の all-or-nothing。
 * - {@link bulkUpsert}: 冪等インポート(再実行しても重複しない)。
 * @packageDocumentation
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { tryCatch, type Result } from "@platform/core";
import { mapPrismaError } from "./errors.js";
import { withTransaction } from "./transaction.js";

/** createMany を持つデリゲート。 */
interface CreateManyDelegate {
  createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
}
/** create を持つデリゲート(tx バインド)。 */
interface CreateDelegate<T> { create(args: { data: unknown }): Promise<T>; }
/** upsert を持つデリゲート(tx バインド)。 */
interface UpsertDelegate<T> { upsert(args: { where: unknown; create: unknown; update: unknown }): Promise<T>; }

/** 配列を指定サイズに分割する。 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** {@link bulkInsert} のオプション。 */
export interface BulkInsertOptions {
  /** 1 回の createMany 件数(既定 1000。DB のパラメータ上限対策)。 */
  chunkSize?: number;
  /** 一意制約に当たった行をスキップするか。 */
  skipDuplicates?: boolean;
}

/**
 * 高速一括挿入(createMany をチャンク分割)。挿入件数のみ返す(ID は返らない)。
 * @example
 * ```ts
 * const res = await bulkInsert(db.log, rows, { chunkSize: 1000, skipDuplicates: true });
 * if (res.ok) console.log(`${res.value.count} 件挿入`);
 * ```
 *
 * @param model Prisma のモデル
 * @param rows 挿入する行
 * @param options.chunkSize 1 回の件数(**大きすぎるとクエリ長の上限に当たる**)
 * @returns 挿入件数
 */
export async function bulkInsert(
  delegate: CreateManyDelegate,
  rows: unknown[],
  options: BulkInsertOptions = {},
): Promise<Result<{ count: number }>> {
  const { chunkSize = 1000, skipDuplicates } = options;
  const r = await tryCatch(async () => {
    let count = 0;
    for (const part of chunk(rows, chunkSize)) {
      const res = await delegate.createMany({ data: part, skipDuplicates });
      count += res.count;
    }
    return { count };
  });
  return r.ok ? r : { ok: false, error: mapPrismaError(r.error.cause ?? r.error) };
}

/**
 * 一括挿入して生成レコード(ID 含む)を返す。トランザクション内で 1 件ずつ作成するため
 * ID が必要な場合に使う(その分 createMany より遅い)。全件成功か全件失敗。
 * @param pick tx から対象デリゲートを取り出す関数(例: `(tx) => tx.user`)
 * @example
 * ```ts
 * const res = await bulkInsertReturning(db, (tx) => tx.user, rows);
 * if (res.ok) res.value.forEach((u) => console.log(u.id)); // 生成された ID
 * ```
 * @returns 挿入した行(**ID が要るとき用**。返さない bulkInsert より遅い)
 */
export async function bulkInsertReturning<T>(
  db: PrismaClient,
  pick: (tx: Prisma.TransactionClient) => CreateDelegate<T>,
  rows: unknown[],
): Promise<Result<T[]>> {
  return withTransaction(db, async (tx) => {
    const delegate = pick(tx);
    const created: T[] = [];
    for (const data of rows) created.push(await delegate.create({ data }));
    return created;
  });
}

/**
 * 冪等な一括アップサート(再実行しても重複しない)。トランザクション内で実行。
 * @param pick tx から対象デリゲートを取り出す関数
 * @param build 各行から `{ where, create, update }` を組み立てる関数
 * @example
 * ```ts
 * await bulkUpsert(db, (tx) => tx.product, items, (p) => ({
 *   where: { sku: p.sku }, create: p, update: { name: p.name, price: p.price },
 * }));
 * ```
 * @returns 処理件数(**あれば更新、無ければ挿入**。取り込みの再実行に強い)
 */
export async function bulkUpsert<Row, T>(
  db: PrismaClient,
  pick: (tx: Prisma.TransactionClient) => UpsertDelegate<T>,
  rows: Row[],
  build: (row: Row) => { where: unknown; create: unknown; update: unknown },
): Promise<Result<T[]>> {
  return withTransaction(db, async (tx) => {
    const delegate = pick(tx);
    const out: T[] = [];
    for (const row of rows) out.push(await delegate.upsert(build(row)));
    return out;
  });
}

/**
 * 1 件作成して生成レコード(ID 含む)を返す。Prisma の create は生成 ID を含む
 * レコードを返すため、「挿入後の ID 取得」はこれで完結する。
 * @example
 * ```ts
 * const res = await insertReturning(db.user, { name: "山田" });
 * if (res.ok) console.log(res.value.id); // 生成された ID
 * ```
 *
 * @param model Prisma のモデル
 * @param row 挿入する行
 * @returns 挿入した行
 */
export async function insertReturning<T>(
  delegate: CreateDelegate<T>,
  data: unknown,
): Promise<Result<T>> {
  const r = await tryCatch(() => delegate.create({ data }));
  return r.ok ? r : { ok: false, error: mapPrismaError(r.error.cause ?? r.error) };
}
