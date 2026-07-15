/**
 * PII 表示マスキング。監査ログ・利用者一覧などで、メール・氏名を役割に応じてマスクする。
 * マスク処理は @platform/pii を利用する。unmask 権限（pii:unmask）を持つ者のみ生値を見られる。
 * @packageDocumentation
 */
import { maskEmail, maskName } from "@platform/pii";

/** メールを表示用にマスク（unmask=true なら生値）。 */
export function maskEmailFor(email: string, unmask: boolean): string {
  return unmask ? email : maskEmail(email);
}

/** 氏名を表示用にマスク（unmask=true なら生値）。 */
export function maskNameFor(name: string, unmask: boolean): string {
  return unmask ? name : maskName(name);
}

/** 監査行（actor/target にメールが入りうる）をマスクする。 */
export function maskAuditRow<T extends { actor: string; target?: string }>(row: T, unmask: boolean): T {
  if (unmask) return row;
  return { ...row, actor: maskIfEmail(row.actor), ...(row.target !== undefined ? { target: maskIfEmail(row.target) } : {}) };
}

/** 利用者レコード（email/name）をマスクする。 */
export function maskUserRecord<T extends { email: string; name: string }>(user: T, unmask: boolean): T {
  if (unmask) return user;
  return { ...user, email: maskEmail(user.email), name: maskName(user.name) };
}

/** 値がメール形式ならマスク、そうでなければそのまま（"system" などは保持）。 */
export function maskIfEmail(value: string): string {
  return value.includes("@") ? maskEmail(value) : value;
}
