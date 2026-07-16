/**
 * `@platform/db` — データベースアクセスの共通部品。
 *
 * 通常の CRUD は Prisma Client(型安全)、複雑な集計は型検証付き生SQL、
 * 複数書き込みはトランザクションを使う。アプリは `@prisma/client` を
 * 直接 import せず、必ずこのパッケージ経由でアクセスする。
 *
 * @packageDocumentation
 */
export { createDb } from "./client";
export {
  queryRaw,
  queryRawValidated,
  executeRaw,
  transaction,
  normalizeBigInt,
  sql,
  rawQuery,
  rawExecute,
} from "./raw";
export { recordAudit, recordAuditChange, type AuditEntry, type AuditChangeEntry } from "./audit";
export { diffChanges, hasChanges, type FieldChange, type DiffOptions } from "./audit-diff";
export { cachedQuery, invalidateQuery, createQueryCache, type QueryCache, type QueryCacheOptions } from "./query-cache";
export { mapPrismaError, isRetryablePrismaError } from "./errors";
export {
  paginate, cursorPaginate, buildPageMeta,
  type Paginated, type CursorPage, type PaginateOptions, type CursorPaginateOptions,
} from "./pagination";
export { transactionWithRetry, checkDatabase, type RetryOptions } from "./resilience";
export { createRepository, type Repository, type RepositoryOptions, type RepositoryDelegate } from "./repository";
export { withTransaction, abortTransaction, type IsolationLevel, type TransactionOptions } from "./transaction";
export { bulkInsert, bulkInsertReturning, bulkUpsert, insertReturning, type BulkInsertOptions } from "./bulk";
export { runMigrations, type MigrateOptions } from "./migrate";
export { createSeeder, type Seeder, type SeedLogger } from "./seed";
export { fullTextSearch, ginIndexSql, isSafeIdentifier, buildTsVectorExpr, type FullTextSearchOptions } from "./search";
export { createTenantClient, tenantWhere, tenantData, type TenantClientOptions } from "./tenant";
export { PrismaClient, Prisma } from "@prisma/client";
