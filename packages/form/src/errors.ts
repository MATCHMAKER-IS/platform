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
 *
 * @param issues zod の検証エラー
 * @returns 項目名 → メッセージ。**同じ項目は最初の 1 件だけ**(全部出すと画面が埋まる)
 */
export function issuesToFieldErrors(issues: ValidationIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path === "" ? "_form" : issue.path;
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * 指定したフィールドのエラーを返す。
 *
 * @param errors エラーの配列
 * @param field 項目名
 * @returns エラーメッセージ。**無ければ undefined**
 */
export function fieldError(errors: FieldErrors, field: string): string | undefined {
  return errors[field];
}

/**
 * エラーが 1 件も無いかを判定する(送信可能か)。
 *
 * @param errors エラーの配列
 * @returns 送信してよいなら true
 */
export function hasNoErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * フォーム全体のエラーを返す(特定の項目に紐づかないもの)。
 *
 * 「開始日は終了日より前にしてください」のような**項目をまたぐ検証**の結果。
 * 項目の横には出せないので、フォームの上部にまとめて出す。
 *
 * @param errors エラーの配列
 * @returns 全体エラーのメッセージ
 */
export function formError(errors: FieldErrors): string | undefined {
  return errors["_form"];
}
