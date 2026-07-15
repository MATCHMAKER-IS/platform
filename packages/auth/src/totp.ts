/**
 * TOTP(時間ベースワンタイムパスワード / RFC 6238)による多要素認証。
 * Google Authenticator・Microsoft Authenticator・1Password 等の認証アプリと互換。
 * シークレットの生成、認証アプリ登録用の otpauth URI(QR コード化)、コード検証(時刻ずれ許容)を提供する。
 * SMS OTP(otp.ts)とは別物: こちらはアプリが時刻から自動生成する方式。
 * @packageDocumentation
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * バイト列を base32(RFC 4648・パディングなし)にエンコードする。
 *
 * @param bytes バイト列
 * @returns Base32 文字列(認証アプリが読める形式)
 */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * base32 文字列をバイト列にデコードする(大小・パディング・空白を許容)。
 *
 * @param text Base32 文字列
 * @returns バイト列
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — Base32 として不正な文字が含まれる場合
 */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`不正な base32 文字: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/**
 * 認証アプリで使うシークレット(base32)を生成する。既定 20 バイト(160bit)。
 *
 * @param length バイト長(既定 20 = RFC 推奨)
 * @returns Base32 の秘密鍵。**利用者ごとに 1 つ生成し、DB に保存する**
 */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** 対応ハッシュアルゴリズム。 */
export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512";

/** HOTP/TOTP 共通オプション。 */
export interface TotpOptions {
  /** 桁数(既定 6)。 */
  digits?: number;
  /** アルゴリズム(既定 SHA1・認証アプリの既定)。 */
  algorithm?: TotpAlgorithm;
  /** 時間ステップ秒(TOTP のみ・既定 30)。 */
  period?: number;
}

/** カウンタを 8 バイトのビッグエンディアンにする。 */
function counterBytes(counter: number): Buffer {
  const buf = Buffer.alloc(8);
  // 上位 32bit / 下位 32bit に分けて書く(2^53 まで安全)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  return buf;
}

/**
 * HOTP(RFC 4226): カウンタベースのコードを生成する。secret は base32。
 *
 * @param secret Base32 の秘密鍵
 * @param counter カウンタ値
 * @param digits 桁数(既定 6)
 * @returns HOTP コード(RFC 4226)
 */
export function hotp(secret: string, counter: number, options: TotpOptions = {}): string {
  const digits = options.digits ?? 6;
  const algo = (options.algorithm ?? "SHA1").toLowerCase();
  const key = Buffer.from(base32Decode(secret));
  const hmac = createHmac(algo, key).update(counterBytes(counter)).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/** 指定時刻のカウンタ(time step)を返す。 */
function timeCounter(period: number, now: Date): number {
  return Math.floor(now.getTime() / 1000 / period);
}

/**
 * TOTP(RFC 6238): 現在時刻のコードを生成する。secret は base32。
 *
 * @param secret Base32 の秘密鍵
 * @param now 現在時刻(テスト注入用)
 * @param options 桁数・時間刻み(既定 6 桁 / 30 秒)
 * @returns 現在時刻の TOTP コード(RFC 6238)
 */
export function totp(secret: string, options: TotpOptions = {}, now: Date = new Date()): string {
  const period = options.period ?? 30;
  return hotp(secret, timeCounter(period, now), options);
}

/** {@link verifyTotp} のオプション。 */
export interface VerifyTotpOptions extends TotpOptions {
  /** 前後に許容するステップ数(時刻ずれ対策・既定 1 = ±30秒)。 */
  window?: number;
}

/**
 * * TOTP コードを検証する(時刻ずれを window ステップ許容・定数時間比較)。
 * 一致すれば true。認証アプリのコード確認・登録時の初回検証に使う。
 *
 * @param secret Base32 の秘密鍵
 * @param code 利用者が入力したコード
 * @param now 現在時刻(テスト注入用)
 * @param options 許容する時刻のずれ(window。既定 1 = 前後 30 秒)
 * @returns 一致すれば true。**端末の時計のずれを吸収するため前後の窓も見る**
 */
export function verifyTotp(secret: string, code: string, options: VerifyTotpOptions = {}, now: Date = new Date()): boolean {
  const period = options.period ?? 30;
  const window = options.window ?? 1;
  const digits = options.digits ?? 6;
  if (!new RegExp(`^\\d{${digits}}$`).test(code)) return false;
  const current = timeCounter(period, now);
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, current + i, options);
    try {
      if (expected.length === code.length && timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
    } catch {
      // 長さ不一致等は不一致扱い
    }
  }
  return false;
}

/** {@link totpAuthUri} のオプション。 */
export interface TotpUriOptions extends TotpOptions {
  /** サービス名(認証アプリでの表示)。 */
  issuer: string;
  /** アカウント名(メール・ユーザー名など)。 */
  account: string;
}

/**
 * * 認証アプリ登録用の otpauth URI を組み立てる(QR コードにして読み取らせる)。
 * 例: otpauth://totp/MyApp:user@example.com?secret=...&issuer=MyApp&digits=6&period=30
 *
 * @param secret Base32 の秘密鍵
 * @param account 利用者の識別子(メールアドレスなど)
 * @param issuer サービス名(認証アプリに表示される)
 * @returns otpauth:// URI。**QR コードにしてスキャンさせる**
 */
export function totpAuthUri(secret: string, options: TotpUriOptions): string {
  const label = encodeURIComponent(`${options.issuer}:${options.account}`);
  const params = new URLSearchParams({
    secret,
    issuer: options.issuer,
    algorithm: options.algorithm ?? "SHA1",
    digits: String(options.digits ?? 6),
    period: String(options.period ?? 30),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
