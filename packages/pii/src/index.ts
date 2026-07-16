/**
 * `@platform/pii` — 個人情報(PII)の保護ヘルパー。
 *
 * 表示/ログ用マスキング、検索可能暗号(blind index)、フィールド暗号化、匿名化(削除権対応)を提供する。
 * 個人情報保護法(APPI)/GDPR 対応の土台。暗号本体は注入(`@platform/crypto` の encrypt/decrypt)する。
 * @packageDocumentation
 */
import { createHmac } from "node:crypto";

// ─────────────────────────── マスキング(表示・ログ用・純関数) ───────────────────────────

/**
 * メールアドレスをマスクする。
 *
 * **ドメインは残す**(社内か社外かは調査に役立つ)。全部隠すと本人確認ができない。
 *
 * @param email メールアドレス
 * @returns マスクしたアドレス。**@ が無ければ全体をマスク**(不正な形式でも漏らさない)
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local[0] ?? "";
  return `${head}***${domain}`;
}

/**
 * 電話番号をマスクする(**末尾 4 桁のみ残す**)。
 *
 * 「自分の番号だ」と分かる最小限。全部隠すと本人確認に使えない。
 *
 * @param phone 電話番号
 * @returns マスクした番号
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * 氏名をマスクする(**先頭 1 文字 + 伏字**)。
 *
 * @param name 氏名
 * @returns マスクした氏名
 */
export function maskName(name: string): string {
  if (name.length === 0) return "";
  return `${name[0]}***`;
}

/**
 * 任意の文字列を部分マスクする。
 *
 * @param value 対象の文字列
 * @param visibleHead 先頭に残す文字数
 * @returns マスクした文字列。**残す文字数が元の長さ以上なら全マスク**(安全側)
 */
export function maskPartial(value: string, visibleHead = 1): string {
  if (value.length <= visibleHead) return "*".repeat(value.length);
  return value.slice(0, visibleHead) + "*".repeat(Math.max(3, value.length - visibleHead));
}

// ─────────────────────────── 検索可能暗号(blind index) ───────────────────────────

/**
 * blind index を作る。値を正規化(小文字化・トリム)して HMAC-SHA256 でハッシュ化する。
 * 暗号化した列とは別に「検索用の決定的ハッシュ列」を持たせることで、平文を復号せずに
 * 完全一致検索(例: メールでユーザ検索)ができる。HMAC 鍵は暗号鍵とは別管理を推奨。
 *
 * @param value 索引を作る値
 * @param secret pepper(**環境変数から**)
 * @returns 決定的なハッシュ。**暗号化した項目を検索可能にする**(完全一致のみ。部分一致はできない)
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

/**
 * フィールド暗号のヘルパーを作る。
 *
 * **DB に入れる前に個人情報を暗号化する**(DB が漏れても中身が読めない)。
 * ただし**暗号化した項目では検索できない**(部分一致も範囲検索も不可)。
 * 検索が要るなら、ハッシュの列を別に持つなどの設計が要る。
 *
 * @param key 暗号鍵(**環境変数から。コードに直書きしない**)
 * @returns 暗号ヘルパー(`encrypt` / `decrypt`)
 */
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
 * @returns 保持期間を過ぎていれば true(**過ぎたデータは消す義務がある**。持ち続けると法令違反)
 */
export function isRetentionExpired(createdAt: number, retentionDays: number, now: number = Date.now()): boolean {
  return now - createdAt > retentionDays * 24 * 60 * 60 * 1000;
}
export * from "./identity-mask.js";
export * from "./subject-rights.js";
