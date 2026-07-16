/**
 * メールログインフォームの入力検証(純ロジック・React 非依存)。
 * クライアント側の軽い検証。本番の厳密な検証は @platform/validation(email/password スキーマ)で行う。
 * @packageDocumentation
 */

/** フォームのエラー(項目ごと。無ければ空)。 */
export interface LoginFormErrors {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * メールアドレスの簡易検証。
 *
 *
 * @param value 判定する文字列
 * @returns メールらしければ true(**厳密な検証ではない**。入力中の表示切替に使う)
 */
export function isEmailLike(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * メールログイン入力を検証する。
 * @param options.minPasswordLength パスワードの最小文字数(既定 8)
 * @returns 問題の一覧(**空なら送信してよい**)
 */
export function validateEmailLogin(
  email: string,
  password: string,
  options: { minPasswordLength?: number } = {},
): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const min = options.minPasswordLength ?? 8;
  if (email.trim() === "") errors.email = "メールアドレスを入力してください";
  else if (!isEmailLike(email)) errors.email = "メールアドレスの形式が正しくありません";
  if (password === "") errors.password = "パスワードを入力してください";
  else if (password.length < min) errors.password = `パスワードは${min}文字以上で入力してください`;
  return errors;
}

/**
 * エラーが無い(送信可能)か。
 *
 *
 * @param form 入力内容
 * @returns 送信できるか(**ボタンの活性を決める**)
 */
export function isLoginFormValid(errors: LoginFormErrors): boolean {
  return !errors.email && !errors.password;
}
