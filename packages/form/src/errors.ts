/**
 * フォームのエラー整形(純ロジック・React 非依存)。
 * @platform/validation の validate() が返す issue 配列を、項目別のエラーメッセージに変換する。
 * @packageDocumentation
 */

/** バリデーションの 1 件の指摘(path=フィールド名, message=メッセージ)。 */
export interface ValidationIssue {
  path: string;
  message: string;
}

/** 項目別のエラー(フィールド名 → 最初のメッセージ)。 */
export type FieldErrors = Record<string, string>;

/**
 * issue 配列を項目別エラーに変換する。同一フィールドは最初のメッセージを採用。
 * ネストした path("address.zip")は先頭セグメントに寄せず、そのままキーにする。
 */
export function issuesToFieldErrors(issues: ValidationIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path === "" ? "_form" : issue.path;
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** 指定フィールドにエラーがあれば返す。 */
export function fieldError(errors: FieldErrors, field: string): string | undefined {
  return errors[field];
}

/** エラーが 1 件も無い(送信可能)か。 */
export function hasNoErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** フォーム全体のエラー(特定フィールドに紐づかないもの)。 */
export function formError(errors: FieldErrors): string | undefined {
  return errors["_form"];
}
