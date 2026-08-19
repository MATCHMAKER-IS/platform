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

/**
 * 検証済みの 1 行(行番号つき)。
 *
 * **`rowIndex` は「ヘッダを除いたデータの何行目か」(1 始まり)。**
 * CSV ファイルの行番号とは**ヘッダの分だけずれる**——
 * `rowIndex: 1` は Excel で開くと **2 行目**にあたる。
 *
 * 画面に出すときは**どちらの番号かを明記すること**
 * (「データ 1 行目」か「ファイル 2 行目」か)。
 * 利用者は Excel で開いて直すので、**ファイルの行番号の方が親切**
 * (`rowIndex + 1`)。2026-08 に明記。
 */
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
 * @returns 行ごとの検証結果。**エラーがあっても他の行は処理する**(1 行の不備で全体を止めない)
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
  /**
   * 検証を通った値を保存する関数。
   *
   * **トランザクションで実装すること。** この関数が途中で例外を投げると、
   * **例外はそのまま呼び出し側へ抜け**、`applied` も `committed` も返らない
   * ——「何件入ったか分からない」状態になり、再実行すると**重複**する。
   *
   * 1 件ずつ INSERT する実装だと**途中まで入る**ので、
   * `prisma.$transaction` などで囲むか、**冪等キーで二重登録を防ぐ**こと
   * (2026-08 に明記)。
   */
  apply: (values: T[]) => Promise<void>;
}

/**
 * 検証してから適用する。検証 → (エラーなし or partial) → apply の順。
 * apply は呼び出し側でトランザクションに包むことで「全件成功か全件ロールバック」を担保できる。
 * @param rows 生の行
 * @param validate 行バリデータ
 * @param options 適用オプション
 * @returns 取り込み結果(成功・失敗の件数と、**失敗した行の理由**)。**部分的な成功を許す**(全件やり直しは現実的でない)
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

/**
 * ヘッダ行と値行から、列名 → 値のオブジェクトを作る。
 *
 * **CSV をパースした後の整形**に使う。列数がヘッダと違う行は、
 * 足りない分を空文字で埋める(**行ごと捨てない**。取り込みで 1 行の欠損が
 * 全体の失敗になると使いにくい)。
 *
 * @param header ヘッダ行
 * @param rows 値の行
 * @returns 列名 → 値 のオブジェクト配列
 */
export function rowsToObjects(header: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => { obj[key] = cols[i] ?? ""; });
    return obj;
  });
}
