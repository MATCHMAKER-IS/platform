/**
 * タイムスタンプ(真実性の補完)。
 * データのハッシュに時刻を署名で結び付け、その時点で存在したことを示す内部トークンを作る。
 * ⚠️ 電子帳簿保存法で認められるタイムスタンプは、時刻認証業務の認定を受けた事業者(認定 TSA)の
 * ものである必要がある。本モジュールは内部的な時刻証跡・TSA 応答のラップ用で、認定 TSA の代替ではない。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual, createHash } from "node:crypto";

/** タイムスタンプトークン。 */
export interface TimestampToken {
  /** 対象データのハッシュ(SHA-256 hex)。 */
  dataHash: string;
  /** 時刻(ISO 8601)。 */
  time: string;
  /** 署名(HMAC-SHA256)。 */
  signature: string;
}

/** 任意データの SHA-256(hex)を返す。 */
export function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function sign(dataHash: string, time: string, secret: string): string {
  return createHmac("sha256", secret).update(`${dataHash}\u0000${time}`).digest("hex");
}

/** データハッシュと時刻を署名して内部タイムスタンプトークンを作る。 */
export function createTimestampToken(dataHash: string, secret: string, time: Date = new Date()): TimestampToken {
  const iso = time.toISOString();
  return { dataHash, time: iso, signature: sign(dataHash, iso, secret) };
}

/** タイムスタンプトークンを検証する(署名が正当で、データハッシュが一致するか)。 */
export function verifyTimestampToken(token: TimestampToken, secret: string, expectedDataHash?: string): boolean {
  if (expectedDataHash !== undefined && token.dataHash !== expectedDataHash) return false;
  const expected = sign(token.dataHash, token.time, secret);
  try {
    return token.signature.length === expected.length && timingSafeEqual(Buffer.from(token.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
