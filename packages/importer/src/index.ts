/**
 * `@platform/importer` — 一括インポートの共通枠組み(依存ゼロ)。
 *
 * CSV/Excel 等から取り込んだ行データに対し、「行ごとバリデーション → エラー行の集約 →
 * ドライラン → トランザクション適用」を統一する。社内アプリのマスタ取込の定番処理を共通化。
 * パース(CSV/xlsx)は @platform/csv / @platform/xlsx に任せ、本パッケージは検証と適用を担う。
 * @packageDocumentation
 */

/** 1行の検証結果。成功なら変換後の値、失敗ならエラー群。 */
export type RowResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** 行バリデータ。生の行(オブジェクト)を受け、型 T へ変換 or エラーを返す。 */
export type RowValidator<Raw, T> = (raw: Raw, rowIndex: number) => RowResult<T>;

/** 検証済みの1行(行番号つき)。 */
export interface ValidRow<T> { rowIndex: number; value: T }

/** エラー行(行番号・元データ・理由)。 */
export interface ErrorRow<Raw> { rowIndex: number; raw: Raw; errors: string[] }

/** 検証フェーズの結果。 */
export interface ValidationReport<Raw, T> {
  valid: ValidRow<T>[];
  errors: ErrorRow<Raw>[];
  /** 全行が有効か。 */
  allValid: boolean;
  total: number;
}

/**
 * 全行を検証し、有効行とエラー行に振り分ける(適用はしない=ドライラン相当)。
 * @param rows 生の行データ
 * @param validate 行バリデータ
 */
export function validateRows<Raw, T>(rows: Raw[], validate: RowValidator<Raw, T>): ValidationReport<Raw, T> {
  const valid: ValidRow<T>[] = [];
  const errors: ErrorRow<Raw>[] = [];
  rows.forEach((raw, i) => {
    const rowIndex = i + 1; // 1 始まり(ヘッダを除いた行番号)
    const r = validate(raw, rowIndex);
    if (r.ok) valid.push({ rowIndex, value: r.value });
    else errors.push({ rowIndex, raw, errors: r.errors });
  });
  return { valid, errors, allValid: errors.length === 0, total: rows.length };
}

/** 適用結果。 */
export interface ImportResult<Raw, T> {
  applied: number;
  valid: ValidRow<T>[];
  errors: ErrorRow<Raw>[];
  /** 適用したか(dryRun や検証失敗時は false)。 */
  committed: boolean;
}

/** {@link runImport} のオプション。 */
export interface ImportOptions<T> {
  /** ドライラン(検証のみ・適用しない)。既定 false。 */
  dryRun?: boolean;
  /**
   * エラー行があっても有効行だけ適用するか。既定 false(1行でもエラーなら全体を中止=安全側)。
   * 業務の「全件成功か全件中止か」という要件に合わせる。
   */
  partial?: boolean;
  /** 適用処理(通常は DB トランザクション内で一括 insert)。valid 行の value 配列を受ける。 */
  apply: (values: T[]) => Promise<void>;
}

/**
 * 検証してから適用する。検証 → (エラーなし or partial) → apply の順。
 * apply は呼び出し側でトランザクションに包むことで「全件成功か全件ロールバック」を担保できる。
 * @param rows 生の行
 * @param validate 行バリデータ
 * @param options 適用オプション
 */
export async function runImport<Raw, T>(
  rows: Raw[],
  validate: RowValidator<Raw, T>,
  options: ImportOptions<T>,
): Promise<ImportResult<Raw, T>> {
  const report = validateRows(rows, validate);
  const base = { valid: report.valid, errors: report.errors };

  if (options.dryRun) return { ...base, applied: 0, committed: false };
  // エラーがあり partial でないなら適用しない(全件中止)
  if (report.errors.length > 0 && !options.partial) return { ...base, applied: 0, committed: false };

  const toApply = report.valid.map((v) => v.value);
  if (toApply.length > 0) await options.apply(toApply);
  return { ...base, applied: toApply.length, committed: true };
}

/** ヘッダ行と値行から、列名→値のオブジェクト配列を作る(CSV パース後の整形に)。 */
export function rowsToObjects(header: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => { obj[key] = cols[i] ?? ""; });
    return obj;
  });
}
