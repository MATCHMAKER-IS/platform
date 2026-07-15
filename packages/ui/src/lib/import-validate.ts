/**
 * 貼り付け/CSV 取り込み行の検証(型・必須・重複)。純関数。
 * @packageDocumentation
 */

/** フィールド型。 */
export type FieldType = "string" | "number" | "date";

/** 取り込みフィールド定義。 */
export interface ImportField {
  key: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  /** 重複を許さない(重複行をエラーにする)。 */
  unique?: boolean;
}

/** セル単位のエラー。 */
export interface CellError { key: string; message: string }

/** 行単位の検証結果。 */
export interface RowValidation { index: number; errors: CellError[] }

/** 全体の検証結果。 */
export interface ImportValidation { rows: RowValidation[]; valid: boolean; errorCount: number }

function isDateLike(s: string): boolean {
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) return !Number.isNaN(Date.parse(s.replace(/[/.]/g, "-")));
  return !Number.isNaN(Date.parse(s));
}
function isNumberLike(s: string): boolean {
  return /^-?[\d,]+(\.\d+)?$/.test(s);
}

/** 取り込み行を検証し、行/セル単位のエラーを返す。 */
export function validateImportRows(rows: Record<string, unknown>[], fields: ImportField[]): ImportValidation {
  const seen: Record<string, Map<string, number>> = {};
  for (const f of fields) if (f.unique) seen[f.key] = new Map();

  const result: RowValidation[] = rows.map((row, index) => {
    const errors: CellError[] = [];
    for (const f of fields) {
      const raw = String(row[f.key] ?? "").trim();
      if (raw === "") {
        if (f.required) errors.push({ key: f.key, message: "必須です" });
        continue;
      }
      if (f.type === "number" && !isNumberLike(raw)) errors.push({ key: f.key, message: "数値で入力してください" });
      else if (f.type === "date" && !isDateLike(raw)) errors.push({ key: f.key, message: "日付が不正です" });
      if (f.unique) {
        const m = seen[f.key]!;
        if (m.has(raw)) errors.push({ key: f.key, message: `重複(${m.get(raw)! + 1}行目と同じ)` });
        else m.set(raw, index);
      }
    }
    return { index, errors };
  });

  const errorCount = result.reduce((s, r) => s + r.errors.length, 0);
  return { rows: result, valid: errorCount === 0, errorCount };
}

/** (row,key)→エラーメッセージ を引ける関数を作る(SheetGrid の cellError 用)。 */
export function cellErrorLookup(validation: ImportValidation): (rowIndex: number, key: string) => string | null {
  const map = new Map<string, string>();
  for (const r of validation.rows) for (const e of r.errors) map.set(`${r.index}:${e.key}`, e.message);
  return (rowIndex, key) => map.get(`${rowIndex}:${key}`) ?? null;
}

/** エラーを含む行のインデックス一覧。 */
export function errorRowIndices(validation: ImportValidation): number[] {
  return validation.rows.filter((r) => r.errors.length > 0).map((r) => r.index);
}

/** エラーを含む行だけを(元インデックス付きで)抽出する。 */
export function filterErrorRows<T>(rows: T[], validation: ImportValidation): { row: T; index: number }[] {
  const idx = new Set(errorRowIndices(validation));
  return rows.map((row, index) => ({ row, index })).filter((x) => idx.has(x.index));
}

/** 取り込みサマリ。 */
export interface ImportSummary { total: number; valid: number; errorRows: number; errorCount: number; ok: boolean }

/** 検証結果からサマリを作る。 */
export function summarizeImport(validation: ImportValidation): ImportSummary {
  const errorRows = errorRowIndices(validation).length;
  return {
    total: validation.rows.length,
    valid: validation.rows.length - errorRows,
    errorRows,
    errorCount: validation.errorCount,
    ok: validation.valid,
  };
}

/** 取り込み履歴の DB 保存行(repository.create にそのまま渡せる)。 */
export interface ImportHistoryRow {
  importId: string;
  source: string;
  userId: string;
  importedAt: string;
  total: number;
  inserted: number;
  errorCount: number;
  status: "success" | "partial" | "failed" | "rolled_back";
}

/** 取り込みメタ + サマリ + 実挿入件数から履歴行を作る。 */
export function buildImportHistory(
  meta: { source: string; userId: string; importId?: string; at?: string },
  summary: ImportSummary,
  inserted: number,
): ImportHistoryRow {
  const status: ImportHistoryRow["status"] = inserted === 0 ? "failed" : inserted < summary.total ? "partial" : "success";
  return {
    importId: meta.importId ?? "",
    source: meta.source,
    userId: meta.userId,
    importedAt: meta.at ?? new Date().toISOString(),
    total: summary.total,
    inserted,
    errorCount: summary.errorCount,
    status,
  };
}

/** ロールバック可能な状態か(挿入があり、未ロールバック)。 */
export function canRollback(status: ImportHistoryRow["status"]): boolean {
  return status === "success" || status === "partial";
}

/**
 * ユーザーがロールバックできるか(状態 + ロール)。allowedRoles のいずれかを持つ場合のみ可。
 * allowedRoles 未指定なら状態のみで判定。
 */
export function canRollbackWith(status: ImportHistoryRow["status"], actorRoles: string[], allowedRoles?: string[]): boolean {
  if (!canRollback(status)) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return actorRoles.some((r) => allowedRoles.includes(r));
}

/** エラーの無い行だけを返す(部分保存用)。 */
export function validRows<T>(rows: T[], validation: ImportValidation): T[] {
  const err = new Set(errorRowIndices(validation));
  return rows.filter((_r, i) => !err.has(i));
}

/** 有効行/無効行に分割する(元インデックス付き)。 */
export function partitionRows<T>(rows: T[], validation: ImportValidation): { valid: { row: T; index: number }[]; invalid: { row: T; index: number }[] } {
  const err = new Set(errorRowIndices(validation));
  const valid: { row: T; index: number }[] = [];
  const invalid: { row: T; index: number }[] = [];
  rows.forEach((row, index) => (err.has(index) ? invalid : valid).push({ row, index }));
  return { valid, invalid };
}
