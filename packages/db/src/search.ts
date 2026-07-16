/**
 * PostgreSQL 全文検索(tsvector)。to_tsvector/websearch_to_tsquery/ts_rank を用い、
 * 複数カラムを対象にランキング付きで検索する。
 *
 * 識別子(テーブル・カラム・言語設定)は安全性を検証してから埋め込み、検索語は
 * パラメータ化するため SQL インジェクションを防ぐ。日本語の分かち書きには
 * pg_bigm / PGroonga 等の拡張と対応する config が必要(language で指定)。
 * @packageDocumentation
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";
import { mapPrismaError } from "./errors.js";

/**
 * SQL 識別子として安全か(英数字とアンダースコアのみ、先頭は英字/アンダースコア)。
 *
 *
 * @param name 識別子(テーブル名・カラム名)
 * @returns 安全なら true。**生 SQL に埋め込む前に必ず通す**(識別子はプレースホルダで渡せないため、
 *   検証しないと SQL インジェクションを許す)
 */
export function isSafeIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/**
 * tsvector 生成式を組み立てる(識別子は検証済み前提)。
 *
 *
 * @param columns 対象のカラム(**検証済みであること**)
 * @param config 全文検索の設定
 * @returns tsvector の式
 */
export function buildTsVectorExpr(columns: string[], language: string): string {
  const parts = columns.map((c) => `coalesce("${c}"::text, '')`).join(" || ' ' || ");
  return `to_tsvector('${language}', ${parts})`;
}

/** {@link fullTextSearch} のオプション。 */
export interface FullTextSearchOptions<T> {
  /** 対象テーブル名。 */
  table: string;
  /** 検索対象カラム(複数可)。 */
  columns: string[];
  /** 検索語(ユーザー入力。パラメータ化される)。 */
  query: string;
  /** テキスト検索 config(既定 "simple"。日本語は拡張の config を指定)。 */
  language?: string;
  /** 取得件数(既定 20)。 */
  limit?: number;
  /** オフセット(既定 0)。 */
  offset?: number;
  /** 行を検証する zod スキーマ(任意)。 */
  schema?: { parse: (v: unknown) => T };
}

/**
 * 全文検索を実行し、ランキング順(ts_rank 降順)で行を返す。
 * @example
 * ```ts
 * const res = await fullTextSearch(db, {
 *   table: "articles", columns: ["title", "body"], query: "決算 発表", limit: 20,
 * });
 * ```
 */
export async function fullTextSearch<T = Record<string, unknown>>(
  db: PrismaClient,
  options: FullTextSearchOptions<T>,
): Promise<Result<T[]>> {
  const { table, columns, query, language = "simple", limit = 20, offset = 0 } = options;

  // 識別子の安全性検証(パラメータ化できない箇所は必ず検証)
  if (!isSafeIdentifier(table)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "テーブル名が不正です") };
  if (columns.length === 0 || !columns.every(isSafeIdentifier)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "カラム名が不正です") };
  if (!isSafeIdentifier(language)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "言語設定が不正です") };

  const vector = Prisma.raw(buildTsVectorExpr(columns, language));
  const tableRef = Prisma.raw(`"${table}"`);
  const tsquery = Prisma.sql`websearch_to_tsquery(${language}, ${query})`;

  const statement = Prisma.sql`
    SELECT *, ts_rank(${vector}, ${tsquery}) AS _rank
    FROM ${tableRef}
    WHERE ${vector} @@ ${tsquery}
    ORDER BY _rank DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const r = await tryCatch(() => db.$queryRaw<T[]>(statement));
  if (!r.ok) return { ok: false, error: mapPrismaError(r.error.cause ?? r.error) };
  if (options.schema) {
    try {
      return { ok: true, value: r.value.map((row) => options.schema!.parse(row)) };
    } catch (e) {
      return { ok: false, error: new AppError(ErrorCode.VALIDATION, "検索結果の検証に失敗しました", { cause: e }) };
    }
  }
  return { ok: true, value: r.value };
}

/**
 * 全文検索を高速化する GIN インデックスの DDL を生成する(マイグレーションに貼る用)。
 * @example
 * ```ts
 * ginIndexSql("articles", ["title", "body"], "simple");
 * // CREATE INDEX ... USING GIN (to_tsvector('simple', ...));
 * ```
 *
 * @param table テーブル名
 * @param columns カラム
 * @returns GIN インデックスの SQL(**全文検索にはこれが必須**。無いと全件走査になる)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 識別子が不正な場合
 */
export function ginIndexSql(table: string, columns: string[], language = "simple"): string {
  if (!isSafeIdentifier(table) || !columns.every(isSafeIdentifier) || !isSafeIdentifier(language)) {
    throw new AppError(ErrorCode.VALIDATION, "識別子が不正です");
  }
  return `CREATE INDEX IF NOT EXISTS "${table}_fts_idx" ON "${table}" USING GIN (${buildTsVectorExpr(columns, language)});`;
}
