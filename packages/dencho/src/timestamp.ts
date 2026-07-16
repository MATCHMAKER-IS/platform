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

/**
 * データの SHA-256 ハッシュを返す。
 *
 * @param data 対象のデータ
 * @returns SHA-256(16 進)
 */
export function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function sign(dataHash: string, time: string, secret: string): string {
  return createHmac("sha256", secret).update(`${dataHash}\u0000${time}`).digest("hex");
}

/**
 * 内部タイムスタンプトークンを作る。
 *
 * **これは認定タイムスタンプではない**。電子帳簿保存法が求める「タイムスタンプ」は
 * 認定事業者(アマノ・セイコー等)の発行が必要。これは**内部の改ざん検知**用で、
 * 法令要件を満たすには外部サービスとの連携が要る。
 *
 * @param dataHash データのハッシュ
 * @param secret 署名鍵
 * @param now 現在時刻(テスト注入用)
 * @returns トークン
 */
export function createTimestampToken(dataHash: string, secret: string, time: Date = new Date()): TimestampToken {
  const iso = time.toISOString();
  return { dataHash, time: iso, signature: sign(dataHash, iso, secret) };
}

/**
 * タイムスタンプトークンを検証する。
 *
 * @param token トークン
 * @param dataHash 検証するデータのハッシュ
 * @param secret 署名鍵
 * @returns 署名が正当で、データが改ざんされていなければ true
 */
export function verifyTimestampToken(token: TimestampToken, secret: string, expectedDataHash?: string): boolean {
  if (expectedDataHash !== undefined && token.dataHash !== expectedDataHash) return false;
  const expected = sign(token.dataHash, token.time, secret);
  try {
    return token.signature.length === expected.length && timingSafeEqual(Buffer.from(token.signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
