/**
 * PostgreSQL 全文検索(tsvector)。to_tsvector/websearch_to_tsquery/ts_rank を用い、
 * 複数カラムを対象にランキング付きで検索する。
 *
 * 識別子(テーブル・カラム・言語設定)は安全性を検証してから埋め込み、検索語は
 * パラメータ化するため SQL インジェクションを防ぐ。日本語の分かち書きには
 * pg_bigm / PGroonga 等の拡張と対応する config が必要(language で指定)。
 * @packageDocumentation
 */
// **`Prisma.sql` / `Prisma.raw` は使わない。** `Prisma`(値)は
// `prisma generate` の生成物で、`typecheck` は generate を走らせないため
// **生成物が無いと型検査が落ちる**(2026-08 の `pnpm typecheck` で発覚)。
// 代わりに `sql-tag.ts` の自前タグを使う——**値は必ずプレースホルダに
// なり、文字列へ連結されない**ので安全性は変わらない。識別子だけは
// プレースホルダで渡せないため `raw()` で埋めるが、**その前に必ず
// `isSafeIdentifier` を通している**(下記の検証を消さないこと)。
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";
import { sql, raw, compileSql } from "./sql-tag";
import { mapPrismaError } from "./errors";
import type { RawCapableClient } from "./client-types";

/**
 * 一度に返す件数の上限。
 *
 * **画面のクエリ文字列から渡る前提で決める。** 全件取得が要る用途
 * (CSV 出力など)は検索ではなくエクスポートの経路で扱う。
 */
export const MAX_SEARCH_LIMIT = 1000;

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
 * @param language 全文検索の設定
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
  db: RawCapableClient,
  options: FullTextSearchOptions<T>,
): Promise<Result<T[]>> {
  const { table, columns, query, language = "simple", limit = 20, offset = 0 } = options;

  // 識別子の安全性検証(パラメータ化できない箇所は必ず検証)
  if (!isSafeIdentifier(table)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "テーブル名が不正です") };
  if (columns.length === 0 || !columns.every(isSafeIdentifier)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "カラム名が不正です") };
  if (!isSafeIdentifier(language)) return { ok: false, error: new AppError(ErrorCode.VALIDATION, "言語設定が不正です") };

  // **件数も検証する。** パラメータ化してあるので SQL インジェクションは無いが、
  // 値の妥当性は別問題:
  //   - 負の LIMIT は PostgreSQL が例外を投げる(利用者には 500 に見える)
  //   - 巨大な LIMIT は全件をメモリに載せる。**画面のクエリ文字列から渡る**ので、
  //     `?limit=9999999` を打たれるだけでサーバが落ちうる
  // 上限は 1000。それ以上が要る用途は、検索ではなくエクスポートで扱うこと。
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    return { ok: false, error: new AppError(ErrorCode.VALIDATION, `limit は 1〜${MAX_SEARCH_LIMIT} の整数で指定してください`) };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, error: new AppError(ErrorCode.VALIDATION, "offset は 0 以上の整数で指定してください") };
  }

  const vector = raw(buildTsVectorExpr(columns, language));
  const tableRef = raw(`"${table}"`);
  const tsquery = sql`websearch_to_tsquery(${language}, ${query})`;

  const statement = sql`
    SELECT *, ts_rank(${vector}, ${tsquery}) AS _rank
    FROM ${tableRef}
    WHERE ${vector} @@ ${tsquery}
    ORDER BY _rank DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const { text, values } = compileSql(statement);
  const r = await tryCatch(() => db.$queryRawUnsafe<T[]>(text, ...values));
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
 * @param language 全文検索の言語設定（既定 `simple`。**日本語は語の区切りが無いので `simple` が無難**）
 * @returns GIN インデックスの SQL(**全文検索にはこれが必須**。無いと全件走査になる)
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 識別子が不正な場合
 */
export function ginIndexSql(table: string, columns: string[], language = "simple"): string {
  if (!isSafeIdentifier(table) || !columns.every(isSafeIdentifier) || !isSafeIdentifier(language)) {
    throw new AppError(ErrorCode.VALIDATION, "識別子が不正です");
  }
  return `CREATE INDEX IF NOT EXISTS "${table}_fts_idx" ON "${table}" USING GIN (${buildTsVectorExpr(columns, language)});`;
}
