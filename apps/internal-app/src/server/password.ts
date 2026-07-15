/**
 * パスワードのハッシュ化・検証・生成（node:crypto の scrypt を使用）。管理画面のパスワード再発行で利用する。
 * @packageDocumentation
 */
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/** 平文パスワードを `salt:hash` 形式に変換する。 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

/** 平文とハッシュ（`salt:hash`）を定数時間で照合する。 */
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 読みやすい一時パスワードを生成する（既定 12 文字）。 */
export function generatePassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}
