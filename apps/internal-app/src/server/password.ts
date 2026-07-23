/**
 * パスワードのハッシュ化・検証・生成。
 *
 * **実装は @platform/crypto に一本化した**(ADR 0015: 同じ機能を 2 か所に持たない)。
 * ここは移行のための薄い層で、次の 2 つだけを担う。
 *
 *   1. 新しいハッシュは基盤の形式(`base64(salt):base64(hash)`・scrypt 64 byte)で作る
 *   2. **古い形式(`hex(salt):hex(hash)`・32 byte)も検証できる**ようにする
 *
 * 2 の互換が無いと、既存利用者が**全員ログインできなくなる**。
 * 古い形式は、次回ログイン時に新しい形式へ書き換える(呼び出し側が needsRehash を見る)。
 * @packageDocumentation
 */
import { scryptSync, timingSafeEqual } from "node:crypto";
import { hashPassword as hashNew, verifyPassword as verifyNew, generatePassword as generateNew } from "@platform/crypto";

/** 新しいパスワードのハッシュ化(基盤の形式)。 */
export function hashPassword(plain: string): string {
  return hashNew(plain);
}

/** 使い捨てパスワードの生成(基盤の実装)。 */
export function generatePassword(length = 12): string {
  return generateNew({ length });
}

/**
 * 旧形式(`hex(salt):hex(hash)`・scrypt 32 byte)の照合。
 * 新形式へ移行しきるまでの経過措置。
 */
function verifyLegacy(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  // 旧形式は hex。base64 の新形式と取り違えないよう、hex かどうかで判別する
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(hash)) return false;
  const candidate = scryptSync(plain, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * パスワードを照合する。新形式・旧形式のどちらでも通る。
 *
 * @param plain  入力された平文
 * @param stored 保存されているハッシュ
 * @returns 一致すれば true
 */
export function verifyPassword(plain: string, stored: string): boolean {
  return verifyNew(plain, stored) || verifyLegacy(plain, stored);
}

/**
 * 保存されているハッシュが古い形式か。
 *
 * true のときは、ログイン成功後に `hashPassword` で作り直して保存する
 * (利用者に気づかせずに新形式へ移行する)。
 *
 * @param stored 保存されているハッシュ
 * @returns 古い形式なら true
 */
export function needsRehash(stored: string): boolean {
  const [salt, hash] = stored.split(":");
  return Boolean(salt && hash && /^[0-9a-f]+$/i.test(salt) && /^[0-9a-f]+$/i.test(hash));
}
