/**
 * `@platform/pii` — 個人情報(PII)の保護ヘルパー。
 *
 * 表示/ログ用マスキング、検索可能暗号(blind index)、フィールド暗号化、匿名化(削除権対応)を提供する。
 * 個人情報保護法(APPI)/GDPR 対応の土台。暗号本体は注入(`@platform/crypto` の encrypt/decrypt)する。
 * @packageDocumentation
 */
import { createHmac } from "node:crypto";

// ─────────────────────────── マスキング(表示・ログ用・純関数) ───────────────────────────

/** メールをマスク(例: "taro@example.co.jp" → "t***@example.co.jp")。 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local[0] ?? "";
  return `${head}***${domain}`;
}

/** 電話番号をマスク(末尾4桁のみ残す。例: "090-1234-5678" → "*******5678")。 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/** 氏名をマスク(先頭1文字＋伏字。例: "山田太郎" → "山***")。 */
export function maskName(name: string): string {
  if (name.length === 0) return "";
  return `${name[0]}***`;
}

/** 任意文字列の部分マスク(先頭 visibleHead 文字だけ残す)。 */
export function maskPartial(value: string, visibleHead = 1): string {
  if (value.length <= visibleHead) return "*".repeat(value.length);
  return value.slice(0, visibleHead) + "*".repeat(Math.max(3, value.length - visibleHead));
}

// ─────────────────────────── 検索可能暗号(blind index) ───────────────────────────

/**
 * blind index を作る。値を正規化(小文字化・トリム)して HMAC-SHA256 でハッシュ化する。
 * 暗号化した列とは別に「検索用の決定的ハッシュ列」を持たせることで、平文を復号せずに
 * 完全一致検索(例: メールでユーザ検索)ができる。HMAC 鍵は暗号鍵とは別管理を推奨。
 */
export function blindIndex(value: string, hmacKey: string): string {
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", hmacKey).update(normalized).digest("hex");
}

// ─────────────────────────── フィールド暗号化 ───────────────────────────

/** 暗号化関数のペア(@platform/crypto の encrypt/decrypt を注入)。 */
export interface FieldCipherDeps {
  encrypt: (plaintext: string) => string;
  decrypt: (ciphertext: string) => string;
}

/** PII フィールドの暗号化ヘルパー。null/undefined はそのまま通す(任意フィールド対応)。 */
export interface FieldCipher {
  encryptField(value: string | null | undefined): string | null;
  decryptField(value: string | null | undefined): string | null;
  /** 暗号化 + blind index をまとめて返す(保存用)。 */
  protect(value: string | null | undefined, hmacKey: string): { enc: string | null; idx: string | null };
}

/** フィールド暗号ヘルパーを作る。 */
export function createFieldCipher(deps: FieldCipherDeps): FieldCipher {
  return {
    encryptField(value) {
      if (value === null || value === undefined) return null;
      return deps.encrypt(value);
    },
    decryptField(value) {
      if (value === null || value === undefined) return null;
      return deps.decrypt(value);
    },
    protect(value, hmacKey) {
      if (value === null || value === undefined) return { enc: null, idx: null };
      return { enc: deps.encrypt(value), idx: blindIndex(value, hmacKey) };
    },
  };
}

// ─────────────────────────── 匿名化(削除権・保持ポリシー) ───────────────────────────

/** 匿名化のトゥームストーン(削除済みを示す既定値)。 */
export const PII_TOMBSTONE = "[削除済み]";

/**
 * レコードの指定フィールドを匿名化する(削除権・保持期間超過時の処理)。
 * 実際の行削除ではなく、PII だけを消して関連データ(集計・監査)は保持する用途。
 * @param record 対象レコード(コピーを返す・元は変更しない)
 * @param fields 匿名化するフィールド名
 * @param tombstone 置換値(既定 {@link PII_TOMBSTONE})
 */
export function anonymizeRecord<T extends Record<string, unknown>>(record: T, fields: (keyof T)[], tombstone: string = PII_TOMBSTONE): T {
  const copy = { ...record };
  for (const f of fields) {
    if (copy[f] !== null && copy[f] !== undefined) copy[f] = tombstone as T[keyof T];
  }
  return copy;
}

/**
 * 保持期限を過ぎたか判定する(保持ポリシー)。
 * @param createdAt レコード作成時刻(epoch ms)
 * @param retentionDays 保持日数
 * @param now 現在時刻(epoch ms)
 */
export function isRetentionExpired(createdAt: number, retentionDays: number, now: number = Date.now()): boolean {
  return now - createdAt > retentionDays * 24 * 60 * 60 * 1000;
}
export * from "./identity-mask.js";
export * from "./subject-rights.js";
