/**
 * 汎用リポジトリ。Prisma のモデルデリゲートを包み、CRUD・ページング・ソフト削除・
 * エラー変換(Result 化)をまとめて提供する。モデルごとの定型コードを削減する。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, tryCatch, type Result } from "@platform/core";
import { mapPrismaError } from "./errors.js";
import { paginate, type Paginated, type PaginateOptions } from "./pagination.js";

/** リポジトリが必要とする Prisma デリゲートの最小形。 */
export interface RepositoryDelegate<T> {
  findUnique(args: { where: Record<string, unknown> }): Promise<T | null>;
  findMany(args: { where?: unknown; orderBy?: unknown; skip: number; take: number }): Promise<T[]>;
  count(args?: { where?: unknown }): Promise<number>;
  create(args: { data: unknown }): Promise<T>;
  update(args: { where: Record<string, unknown>; data: unknown }): Promise<T>;
  delete(args: { where: Record<string, unknown> }): Promise<T>;
}

/** {@link createRepository} のオプション。 */
export interface RepositoryOptions {
  /** 主キー名(既定 "id")。 */
  idField?: string;
  /** ソフト削除カラム名(指定するとソフト削除・除外を有効化)。 */
  softDeleteField?: string;
}

/** 汎用リポジトリの操作(すべて Result を返す)。 */
export interface Repository<T> {
  /** ID で 1 件取得(無ければ null)。 */
  findById(id: string | number): Promise<Result<T | null>>;
  /** ID で 1 件取得(無ければ NOT_FOUND)。 */
  findByIdOrThrow(id: string | number): Promise<Result<T>>;
  /** 作成。 */
  create(data: unknown): Promise<Result<T>>;
  /** 更新。 */
  update(id: string | number, data: unknown): Promise<Result<T>>;
  /** 削除(softDeleteField 指定時はソフト削除)。 */
  remove(id: string | number): Promise<Result<T>>;
  /** 一覧(オフセットページング、ソフト削除は除外)。 */
  list(options?: PaginateOptions): Promise<Result<Paginated<T>>>;
}

/**
 * デリゲートから汎用リポジトリを作る。
 * @example
 * ```ts
 * const users = createRepository(db.user, { softDeleteField: "deletedAt" });
 * const res = await users.findByIdOrThrow(id);   // NOT_FOUND を自動処理
 * const page = await users.list({ page: 1, pageSize: 20 });
 * await users.remove(id);                        // deletedAt をセット(ソフト削除)
 * ```
 *
 * @param model Prisma のモデル
 * @param options.toDomain / toRow ドメインと行の変換
 * @returns リポジトリ(**Prisma の型をアプリに漏らさない**)
 */
export function createRepository<T>(delegate: RepositoryDelegate<T>, options: RepositoryOptions = {}): Repository<T> {
  const { idField = "id", softDeleteField } = options;
  const notDeleted = softDeleteField ? { [softDeleteField]: null } : {};
  const mergeWhere = (where?: unknown) => ({ ...(where as object), ...notDeleted });

  return {
    async findById(id) {
      const r = await tryCatch(() => delegate.findUnique({ where: { [idField]: id } }));
      return r.ok ? ok(r.value) : err(mapPrismaError(r.error.cause ?? r.error));
    },
    async findByIdOrThrow(id) {
      const r = await tryCatch(() => delegate.findUnique({ where: { [idField]: id } }));
      if (!r.ok) return err(mapPrismaError(r.error.cause ?? r.error));
      if (!r.value) return err(new AppError(ErrorCode.NOT_FOUND, "対象が見つかりません", { details: { [idField]: id } }));
      return ok(r.value);
    },
    async create(data) {
      const r = await tryCatch(() => delegate.create({ data }));
      return r.ok ? ok(r.value) : err(mapPrismaError(r.error.cause ?? r.error));
    },
    async update(id, data) {
      const r = await tryCatch(() => delegate.update({ where: { [idField]: id }, data }));
      return r.ok ? ok(r.value) : err(mapPrismaError(r.error.cause ?? r.error));
    },
    async remove(id) {
      const run = softDeleteField
        ? () => delegate.update({ where: { [idField]: id }, data: { [softDeleteField]: new Date() } })
        : () => delegate.delete({ where: { [idField]: id } });
      const r = await tryCatch(run);
      return r.ok ? ok(r.value) : err(mapPrismaError(r.error.cause ?? r.error));
    },
    async list(opts = {}) {
      const r = await tryCatch(() => paginate(delegate, { ...opts, where: mergeWhere(opts.where) }));
      return r.ok ? ok(r.value) : err(mapPrismaError(r.error.cause ?? r.error));
    },
  };
}
