/**
 * 生SQL の実行ヘルパー。
 *
 * - `sql\`\`` タグでパラメータ化し、SQL インジェクションを防ぐ。
 * - 失敗は {@link @platform/core#AppError}(コード `DATABASE`)に正規化する。
 * - `queryRawValidated` は結果を zod スキーマで検証し、`queryRaw<T>` のような
 *   「実行時未検証のキャスト」による型の嘘を防ぐ。
 * - PostgreSQL の `COUNT(*)` 等は BigInt を返すため {@link normalizeBigInt} を用意。
 *
 * @packageDocumentation
 */

import type { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

function toDbError(cause: unknown): AppError {
  return new AppError(ErrorCode.DATABASE, "生SQLの実行に失敗しました", { cause });
}

/**
 * パラメータ化された生SQL(SELECT 等)を実行し、行配列を返す。
 *
 * 型 `T` は呼び出し側のキャストであり実行時検証はされない。厳密さが要る場合は
 * {@link queryRawValidated} を使うこと。
 *
 * @typeParam T 期待する行の型
 * @param db    {@link createDb} で得た PrismaClient
 * @param query `sql\`...\`` で作ったクエリ
 * @returns 成功なら行配列の `ok`、失敗なら `DATABASE` の `err`
 */
export async function queryRaw<T>(
  db: PrismaClient,
  query: Prisma.Sql,
): Promise<Result<T[]>> {
  const res = await tryCatch(() => db.$queryRaw<T[]>(query));
  return res.ok ? res : { ok: false, error: toDbError(res.error.cause ?? res.error) };
}

/**
 * 生SQL を実行し、各行を zod スキーマで検証して返す。
 * 実行時に型が保証されるため、集計クエリなど「型が曖昧になりがちな」箇所に使う。
 *
 * @typeParam S 行スキーマの型
 * @param db     PrismaClient
 * @param query  `sql\`...\`` で作ったクエリ
 * @param schema 1 行分を検証する zod スキーマ
 * @returns 検証済み行配列の `ok`、SQL 失敗または検証失敗なら `err`
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * const row = z.object({ id: z.number(), total: z.bigint() });
 * const res = await queryRawValidated(db, sql`SELECT ...`, row);
 * ```
 */
export async function queryRawValidated<S extends z.ZodTypeAny>(
  db: PrismaClient,
  query: Prisma.Sql,
  schema: S,
): Promise<Result<z.infer<S>[]>> {
  const res = await tryCatch(() => db.$queryRaw<unknown[]>(query));
  if (!res.ok) return { ok: false, error: toDbError(res.error.cause ?? res.error) };

  const rows: z.infer<S>[] = [];
  for (const raw of res.value) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: new AppError(ErrorCode.DATABASE, "生SQL結果の検証に失敗しました", {
          details: { issues: parsed.error.issues },
        }),
      };
    }
    rows.push(parsed.data);
  }
  return { ok: true, value: rows };
}

/**
 * パラメータ化された生SQL(INSERT/UPDATE/DELETE 等)を実行し、影響行数を返す。
 *
 * @param db    PrismaClient
 * @param query `sql\`...\`` で作ったクエリ
 * @returns 影響行数の `ok`、失敗なら `DATABASE` の `err`
 */
export async function executeRaw(
  db: PrismaClient,
  query: Prisma.Sql,
): Promise<Result<number>> {
  const res = await tryCatch(() => db.$executeRaw(query));
  return res.ok ? res : { ok: false, error: toDbError(res.error.cause ?? res.error) };
}

/**
 * 複数の書き込みを 1 トランザクションで実行する。
 * いずれかが失敗すれば全体がロールバックされる。
 *
 * @typeParam T コールバックの戻り値
 * @param db PrismaClient
 * @param fn トランザクションクライアントを受け取る処理
 * @returns 成功なら結果の `ok`、失敗なら `DATABASE` の `err`(自動ロールバック)
 *
 * @example
 * ```ts
 * const res = await transaction(db, async (tx) => {
 *   await tx.order.create({ data });
 *   await tx.stock.update({ where, data });
 *   return "done";
 * });
 * ```
 */
export async function transaction<T>(
  db: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<Result<T>> {
  const res = await tryCatch(() => db.$transaction(fn));
  return res.ok ? res : { ok: false, error: toDbError(res.error.cause ?? res.error) };
}

/**
 * BigInt を含むオブジェクトを JSON 安全な形(number/string)に変換する。
 * PostgreSQL の集計結果をそのまま `JSON.stringify` すると例外になるため使う。
 *
 * @param value 変換対象(BigInt は Number.MAX_SAFE_INTEGER 以下なら number、超過なら string)
 * @returns JSON 化可能な値
 */
export function normalizeBigInt<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "bigint"
        ? v <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(v)
          : v.toString()
        : v,
    ),
  );
}

/**
 * SQL タグ。値をプレースホルダ化して安全にクエリを組み立てる。
 */
export const sql = Prisma.sql;

/**
 * 普通の SQL 文字列を実行して結果行を返す(SELECT 等)。
 * パラメータは `$1, $2, ...` のプレースホルダで束縛する(SQL インジェクション対策)。
 * ⚠️ SQL 文字列自体にユーザー入力を連結しないこと。値は必ず params で渡す。
 *
 * @example
 * ```ts
 * const res = await rawQuery(db, "SELECT * FROM users WHERE age > $1 AND active = $2", [20, true]);
 * ```
 */
export async function rawQuery<T = Record<string, unknown>>(
  db: PrismaClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<Result<T[]>> {
  const res = await tryCatch(() => db.$queryRawUnsafe<T[]>(sqlText, ...params));
  return res.ok ? res : { ok: false, error: toDbError(res.error.cause ?? res.error) };
}

/**
 * 普通の SQL 文字列を実行して影響行数を返す(INSERT/UPDATE/DELETE/DDL 等)。
 * パラメータは `$1, $2, ...` で束縛する。
 *
 * @example
 * ```ts
 * const res = await rawExecute(db, "UPDATE users SET active = $1 WHERE id = $2", [false, id]);
 * if (res.ok) console.log(`${res.value} 行更新`);
 * ```
 */
export async function rawExecute(
  db: PrismaClient,
  sqlText: string,
  params: unknown[] = [],
): Promise<Result<number>> {
  const res = await tryCatch(() => db.$executeRawUnsafe(sqlText, ...params));
  return res.ok ? res : { ok: false, error: toDbError(res.error.cause ?? res.error) };
}
