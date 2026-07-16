/**
 * OTP(認証コード)SMS 本文の組み立て。コードの生成・検証は @platform/auth の OTP を使い、
 * ここは「送る文面」を作るだけ(sms は auth に依存しない)。
 * @packageDocumentation
 */
import type { SmsMessage } from "./index";

/** {@link buildOtpSms} のオプション。 */
export interface OtpSmsOptions {
  /** 送信先電話番号(E.164 等)。 */
  to: string;
  /** 送信するコード。 */
  code: string;
  /** サービス名(文面に含める)。 */
  appName?: string;
  /** 有効期間(分)を文面に含める。 */
  expiryMinutes?: number;
  /** 本文テンプレート({code}/{app}/{minutes} を差し込む)。既定の日本語文面を上書きできる。 */
  template?: string;
}

/**
 * 認証コード SMS を組み立てる。iOS/Android の自動入力に配慮し、コードは分かりやすく提示する。
 * 既定文面: 「【アプリ名】認証コード: 123456(5分間有効)」
 *
 * @param code OTP コード
 * @param options.appName アプリ名
 * @returns SMS 本文(**短く保つ**。長いと分割されて課金が倍になる)
 */
export function buildOtpSms(options: OtpSmsOptions): SmsMessage {
  const { to, code, appName, expiryMinutes } = options;
  let body: string;
  if (options.template) {
    body = options.template
      .replace(/\{code\}/g, code)
      .replace(/\{app\}/g, appName ?? "")
      .replace(/\{minutes\}/g, expiryMinutes != null ? String(expiryMinutes) : "");
  } else {
    const prefix = appName ? `【${appName}】` : "";
    const expiry = expiryMinutes != null ? `(${expiryMinutes}分間有効)` : "";
    body = `${prefix}認証コード: ${code}${expiry}`;
  }
  return { to, body };
}
