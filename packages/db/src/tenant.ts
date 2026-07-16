/**
 * マルチテナント(行レベルテナンシー)の自動スコープ。
 *
 * - {@link tenantWhere} / {@link tenantData}: where にテナント条件を合成、create にテナントIDを付与(明示的・堅牢)。
 * - {@link createTenantClient}: Prisma Client 拡張で全モデルの操作へ自動的にテナント条件を注入(高度)。
 *
 * @packageDocumentation
 */
import type { PrismaClient } from "@prisma/client";

/**
 * where 句にテナント条件を合成する。
 *
 *
 * @param tenantId テナント
 * @param where 元の条件
 * @returns テナント条件を足した where。**全クエリに必ず適用する**(1 箇所でも漏れると、他社のデータが見える)
 */
export function tenantWhere(tenantId: string, where: unknown, tenantField = "tenantId"): Record<string, unknown> {
  return where && typeof where === "object"
    ? { AND: [where, { [tenantField]: tenantId }] }
    : { [tenantField]: tenantId };
}

/** create の data にテナントIDを付与する。 */
export function tenantData<T extends Record<string, unknown>>(tenantId: string, data: T, tenantField = "tenantId"): T {
  return { ...data, [tenantField]: tenantId };
}

/** {@link createTenantClient} のオプション。 */
export interface TenantClientOptions {
  /** テナントを表すカラム名(既定 "tenantId")。 */
  tenantField?: string;
}

// where を受け取り、テナント条件を注入する読み取り/一括操作
const WHERE_OPS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]);

/**
 * テナントで自動スコープされた Prisma クライアントを作る(Client 拡張)。
 * 全モデルの読み取り・一括更新/削除・件数集計に自動でテナント条件を付け、
 * create/createMany には自動でテナントIDを付与する。
 *
 * @remarks
 * `findUnique` / 単一 `update` / `delete`(ユニークキー指定)は自動スコープの対象外。
 * これらはテナントIDを含む複合ユニークキーを使うか、`findFirst` に置き換える。
 *
 * @example
 * ```ts
 * const tdb = createTenantClient(db, currentTenantId);
 * await tdb.order.findMany();               // 自動で WHERE tenantId = ...
 * await tdb.order.create({ data: {...} });  // 自動で tenantId を付与
 * ```
 *
 * @param db Prisma クライアント
 * @param tenantId テナント
 * @returns テナント条件を自動で付けるクライアント(**付け忘れを防ぐ**。手で書くと必ずどこかで漏れる)
 */
export function createTenantClient(db: PrismaClient, tenantId: string, options: TenantClientOptions = {}): PrismaClient {
  const tenantField = options.tenantField ?? "tenantId";
  const extended = (db as unknown as {
    $extends: (ext: unknown) => PrismaClient;
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }: { operation: string; args: Record<string, unknown>; query: (a: unknown) => Promise<unknown> }) {
          if (WHERE_OPS.has(operation)) {
            args.where = tenantWhere(tenantId, args.where, tenantField);
          } else if (operation === "create") {
            args.data = tenantData(tenantId, (args.data as Record<string, unknown>) ?? {}, tenantField);
          } else if (operation === "createMany") {
            const data = args.data;
            args.data = Array.isArray(data)
              ? data.map((d) => tenantData(tenantId, d as Record<string, unknown>, tenantField))
              : tenantData(tenantId, (data as Record<string, unknown>) ?? {}, tenantField);
          }
          return query(args);
        },
      },
    },
  });
  return extended;
}
