/**
 * DB Viewer(phpMyAdmin 的な閲覧・操作)のサービス層。
 * @platform/db の rawQuery/rawExecute を土台に、information_schema でメタ情報を取得し、
 * テーブル一覧・スキーマ・データ閲覧・行の挿入/更新/削除・任意 SQL 実行を提供する。
 *
 * ## 安全対策(重要)
 * - 管理者専用(route 側で権限チェック)。
 * - 識別子(テーブル名・カラム名)は information_schema に実在するものだけ許可(ホワイトリスト方式)。
 *   → 識別子は文字列連結せざるを得ないため、実在確認 + 厳格な文字種チェックで防御する。
 * - 値は必ずパラメータ化($1, $2, ...)して SQL インジェクションを防ぐ。
 * - 任意 SQL 実行はマルチステートメント禁止・危険操作(DROP/TRUNCATE 等)は明示フラグが必要。
 * @packageDocumentation
 */
import { rawQuery, rawExecute, normalizeBigInt } from "@platform/db";
import { toCsv, parseCsv } from "@platform/csv";
import { db } from "./services.js";
import { type Result, ok, err, AppError, ErrorCode } from "@platform/core";

/** 識別子(テーブル/カラム名)として許可する文字。英数字・アンダースコアのみ。 */
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** public スキーマのテーブル一覧を返す。 */
export async function listTables(): Promise<Result<{ name: string; rows: number }[]>> {
  const r = await rawQuery<{ table_name: string }>(
    db,
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  if (!r.ok) return r;
  const tables = r.value.map((t) => t.table_name);
  const out: { name: string; rows: number }[] = [];
  for (const name of tables) {
    // 行数概算(実在確認済みの識別子のみ・許可文字チェック)
    if (!IDENT_RE.test(name)) continue;
    const c = await rawQuery<{ count: unknown }>(db, `SELECT COUNT(*)::int AS count FROM "${name}"`);
    out.push({ name, rows: c.ok && c.value[0] ? Number(normalizeBigInt(c.value[0].count)) : 0 });
  }
  return ok(out);
}

/** テーブルが実在するか(information_schema で確認)。識別子インジェクション対策の要。 */
async function tableExists(table: string): Promise<boolean> {
  if (!IDENT_RE.test(table)) return false;
  const r = await rawQuery<{ n: unknown }>(
    db,
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.ok && r.value[0] ? Number(normalizeBigInt(r.value[0].n)) > 0 : false;
}

/** カラム定義を返す。 */
export async function describeTable(table: string): Promise<Result<{ column: string; type: string; nullable: boolean; default: string | null }[]>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const r = await rawQuery<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
    db,
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table],
  );
  if (!r.ok) return r;
  return ok(r.value.map((c) => ({ column: c.column_name, type: c.data_type, nullable: c.is_nullable === "YES", default: c.column_default })));
}

/** そのテーブルの実在カラム名の集合を返す(値の挿入/更新で使う)。 */
async function columnSet(table: string): Promise<Set<string>> {
  const d = await describeTable(table);
  return d.ok ? new Set(d.value.map((c) => c.column)) : new Set();
}

/** テーブルのデータをページングして返す。 */
export async function selectRows(table: string, options: { limit?: number; offset?: number } = {}): Promise<Result<{ rows: Record<string, unknown>[]; total: number }>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  const rowsR = await rawQuery<Record<string, unknown>>(db, `SELECT * FROM "${table}" LIMIT $1 OFFSET $2`, [limit, offset]);
  if (!rowsR.ok) return rowsR;
  const countR = await rawQuery<{ count: unknown }>(db, `SELECT COUNT(*)::int AS count FROM "${table}"`);
  const total = countR.ok && countR.value[0] ? Number(normalizeBigInt(countR.value[0].count)) : rowsR.value.length;
  return ok({ rows: rowsR.value.map((r) => normalizeBigInt(r) as Record<string, unknown>), total });
}

/** 行を挿入する(values のキーは実在カラムのみ・値はパラメータ化)。 */
export async function insertRow(table: string, values: Record<string, unknown>): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const cols = await columnSet(table);
  const keys = Object.keys(values).filter((k) => cols.has(k) && IDENT_RE.test(k));
  if (keys.length === 0) return err(new AppError(ErrorCode.VALIDATION, "有効なカラムがありません"));
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const colList = keys.map((k) => `"${k}"`).join(", ");
  const params = keys.map((k) => values[k]);
  return rawExecute(db, `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`, params);
}

/** 行を更新する(where のキーも実在カラムのみ)。 */
export async function updateRows(table: string, values: Record<string, unknown>, where: Record<string, unknown>): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const cols = await columnSet(table);
  const setKeys = Object.keys(values).filter((k) => cols.has(k) && IDENT_RE.test(k));
  const whereKeys = Object.keys(where).filter((k) => cols.has(k) && IDENT_RE.test(k));
  if (setKeys.length === 0) return err(new AppError(ErrorCode.VALIDATION, "更新するカラムがありません"));
  if (whereKeys.length === 0) return err(new AppError(ErrorCode.VALIDATION, "WHERE 条件が必要です(全行更新は禁止)"));
  const setClause = setKeys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
  const whereClause = whereKeys.map((k, i) => `"${k}" = $${setKeys.length + i + 1}`).join(" AND ");
  const params = [...setKeys.map((k) => values[k]), ...whereKeys.map((k) => where[k])];
  return rawExecute(db, `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`, params);
}

/** 行を削除する(WHERE 必須・全行削除は禁止)。 */
export async function deleteRows(table: string, where: Record<string, unknown>): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const cols = await columnSet(table);
  const whereKeys = Object.keys(where).filter((k) => cols.has(k) && IDENT_RE.test(k));
  if (whereKeys.length === 0) return err(new AppError(ErrorCode.VALIDATION, "WHERE 条件が必要です(全行削除は禁止)"));
  const whereClause = whereKeys.map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
  const params = whereKeys.map((k) => where[k]);
  return rawExecute(db, `DELETE FROM "${table}" WHERE ${whereClause}`, params);
}

/** 任意 SQL の実行種別を判定する。 */
export function classifySql(sql: string): { kind: "read" | "write" | "danger" | "ddl"; statement: string } {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  const head = trimmed.toLowerCase().split(/\s+/)[0] ?? "";
  const danger = ["drop", "truncate", "grant", "revoke"];
  const ddl = ["create", "alter"];
  if (danger.includes(head)) return { kind: "danger", statement: trimmed };
  if (ddl.includes(head)) return { kind: "ddl", statement: trimmed };
  if (["select", "with", "show", "explain"].includes(head)) return { kind: "read", statement: trimmed };
  return { kind: "write", statement: trimmed };
}

/**
 * 任意 SQL を実行する。マルチステートメント禁止。
 * danger 種別(DROP/TRUNCATE 等)は allowDanger=true が無いと拒否。
 */
export async function runSql(sql: string, options: { allowDanger?: boolean; allowDdl?: boolean } = {}): Promise<Result<{ kind: string; rows?: Record<string, unknown>[]; affected?: number }>> {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (trimmed === "") return err(new AppError(ErrorCode.VALIDATION, "SQL が空です"));
  // マルチステートメント(文字列/識別子外の ; )を粗く禁止
  if (/;/.test(trimmed)) return err(new AppError(ErrorCode.VALIDATION, "複数ステートメントは実行できません"));
  const { kind } = classifySql(trimmed);
  if (kind === "danger" && !options.allowDanger) {
    return err(new AppError(ErrorCode.FORBIDDEN, "危険な操作(DROP/TRUNCATE 等)は確認が必要です"));
  }
  if (kind === "ddl" && !options.allowDanger && !options.allowDdl) {
    return err(new AppError(ErrorCode.FORBIDDEN, "スキーマ変更(CREATE/ALTER)は確認が必要です"));
  }
  if (kind === "read") {
    const r = await rawQuery<Record<string, unknown>>(db, trimmed);
    if (!r.ok) return r;
    return ok({ kind, rows: r.value.map((row) => normalizeBigInt(row) as Record<string, unknown>) });
  }
  const r = await rawExecute(db, trimmed);
  if (!r.ok) return r;
  return ok({ kind, affected: r.value });
}

/** 型定義(カラム定義)。DDL ヘルパで使う。 */
export interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  default?: string;
}

/** 許可する PostgreSQL データ型(ホワイトリスト)。任意の型文字列を弾く。 */
const ALLOWED_TYPES = new Set([
  "text", "varchar", "char", "integer", "int", "bigint", "smallint", "serial", "bigserial",
  "boolean", "bool", "date", "timestamp", "timestamptz", "time", "numeric", "decimal",
  "real", "double precision", "json", "jsonb", "uuid", "bytea",
]);

function validType(type: string): boolean {
  // "varchar(255)" のような括弧付きも許可(基本型が許可リストにあれば)
  const base = type.toLowerCase().replace(/\(.*\)$/, "").trim();
  return ALLOWED_TYPES.has(base);
}

/**
 * テーブルを作成する(DDL)。列名・型はホワイトリスト検証。既存テーブルは IF NOT EXISTS で安全。
 * 型やカラム名が不正なら実行せず VALIDATION。
 */
export async function createTable(table: string, columns: ColumnDef[]): Promise<Result<number>> {
  if (!IDENT_RE.test(table)) return err(new AppError(ErrorCode.VALIDATION, "テーブル名が不正です"));
  if (columns.length === 0) return err(new AppError(ErrorCode.VALIDATION, "カラムが必要です"));
  const defs: string[] = [];
  for (const c of columns) {
    if (!IDENT_RE.test(c.name)) return err(new AppError(ErrorCode.VALIDATION, `カラム名が不正です: ${c.name}`));
    if (!validType(c.type)) return err(new AppError(ErrorCode.VALIDATION, `許可されない型です: ${c.type}`));
    let def = `"${c.name}" ${c.type}`;
    if (c.primaryKey) def += " PRIMARY KEY";
    if (c.nullable === false && !c.primaryKey) def += " NOT NULL";
    if (c.default !== undefined) def += ` DEFAULT ${c.default}`;
    defs.push(def);
  }
  return rawExecute(db, `CREATE TABLE IF NOT EXISTS "${table}" (${defs.join(", ")})`);
}

/** テーブルを削除する(DROP)。存在確認あり。危険操作。 */
export async function dropTable(table: string): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  return rawExecute(db, `DROP TABLE IF EXISTS "${table}"`);
}

/** カラムを追加する(ALTER TABLE ADD COLUMN)。型ホワイトリスト検証。 */
export async function addColumn(table: string, column: ColumnDef): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  if (!IDENT_RE.test(column.name)) return err(new AppError(ErrorCode.VALIDATION, "カラム名が不正です"));
  if (!validType(column.type)) return err(new AppError(ErrorCode.VALIDATION, `許可されない型です: ${column.type}`));
  let def = `ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type}`;
  if (column.nullable === false) def += " NOT NULL";
  if (column.default !== undefined) def += ` DEFAULT ${column.default}`;
  return rawExecute(db, `ALTER TABLE "${table}" ${def}`);
}

/** カラムを削除する(ALTER TABLE DROP COLUMN)。危険操作。 */
export async function dropColumn(table: string, column: string): Promise<Result<number>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  if (!IDENT_RE.test(column)) return err(new AppError(ErrorCode.VALIDATION, "カラム名が不正です"));
  return rawExecute(db, `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
}

// ─────────────────────────── CSV 入出力 ───────────────────────────

/** テーブルのデータを CSV 文字列にエクスポートする(全行・BOM 付きで Excel 対応)。 */
export async function exportTableCsv(table: string, options: { limit?: number } = {}): Promise<Result<string>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const limit = Math.min(options.limit ?? 10000, 100000);
  const r = await rawQuery<Record<string, unknown>>(db, `SELECT * FROM "${table}" LIMIT $1`, [limit]);
  if (!r.ok) return r;
  const rows = r.value.map((row) => normalizeBigInt(row) as Record<string, unknown>);
  return ok(toCsv(rows, { bom: true }));
}

/**
 * CSV 文字列をテーブルにインポートする(1 行ずつ INSERT)。
 * ヘッダ行のカラム名は実在カラムのみ採用。値はパラメータ化。
 * @returns 挿入できた行数
 */
export async function importTableCsv(table: string, csvText: string): Promise<Result<{ inserted: number; skipped: number }>> {
  if (!(await tableExists(table))) return err(new AppError(ErrorCode.NOT_FOUND, `テーブル ${table} は存在しません`));
  const parsed = parseCsv(csvText, { header: true }) as Record<string, string>[];
  if (!Array.isArray(parsed) || parsed.length === 0) return err(new AppError(ErrorCode.VALIDATION, "CSV に取り込む行がありません"));
  const cols = await columnSet(table);
  let inserted = 0;
  let skipped = 0;
  for (const row of parsed) {
    const keys = Object.keys(row).filter((k) => cols.has(k) && IDENT_RE.test(k));
    if (keys.length === 0) { skipped += 1; continue; }
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const colList = keys.map((k) => `"${k}"`).join(", ");
    // 空文字は NULL として扱う(型不一致を避ける)
    const params = keys.map((k) => (row[k] === "" ? null : row[k]));
    const ins = await rawExecute(db, `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`, params);
    if (ins.ok) inserted += 1;
    else skipped += 1;
  }
  return ok({ inserted, skipped });
}
