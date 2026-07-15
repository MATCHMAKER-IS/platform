/**
 * `@platform/db` — データベースアクセスの共通部品。
 *
 * 通常の CRUD は Prisma Client(型安全)、複雑な集計は型検証付き生SQL、
 * 複数書き込みはトランザクションを使う。アプリは `@prisma/client` を
 * 直接 import せず、必ずこのパッケージ経由でアクセスする。
 *
 * @packageDocumentation
 */
export { createDb } from "./client.js";
export {
  queryRaw,
  queryRawValidated,
  executeRaw,
  transaction,
  normalizeBigInt,
  sql,
  rawQuery,
  rawExecute,
} from "./raw.js";
export { recordAudit, recordAuditChange, type AuditEntry, type AuditChangeEntry } from "./audit.js";
export { diffChanges, hasChanges, type FieldChange, type DiffOptions } from "./audit-diff.js";
export { cachedQuery, invalidateQuery, createQueryCache, type QueryCache, type QueryCacheOptions } from "./query-cache.js";
export { mapPrismaError, isRetryablePrismaError } from "./errors.js";
export {
  paginate, cursorPaginate, buildPageMeta,
  type Paginated, type CursorPage, type PaginateOptions, type CursorPaginateOptions,
} from "./pagination.js";
export { transactionWithRetry, checkDatabase, type RetryOptions } from "./resilience.js";
export { createRepository, type Repository, type RepositoryOptions, type RepositoryDelegate } from "./repository.js";
export { withTransaction, abortTransaction, type IsolationLevel, type TransactionOptions } from "./transaction.js";
export { bulkInsert, bulkInsertReturning, bulkUpsert, insertReturning, type BulkInsertOptions } from "./bulk.js";
export { runMigrations, type MigrateOptions } from "./migrate.js";
export { createSeeder, type Seeder, type SeedLogger } from "./seed.js";
export { fullTextSearch, ginIndexSql, isSafeIdentifier, buildTsVectorExpr, type FullTextSearchOptions } from "./search.js";
export { createTenantClient, tenantWhere, tenantData, type TenantClientOptions } from "./tenant.js";
export { PrismaClient, Prisma } from "@prisma/client";
