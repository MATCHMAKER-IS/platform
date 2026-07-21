/**
 * eKYC ベンダーからの判定 Webhook の署名検証とパース。
 * ベンダーにより署名方式(HMAC hex/base64)が異なるため設定可能。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEkycStatus, type EkycStatus } from "./status";

/**
 * Webhook 署名を検証する。
 * @param body リクエストの生ボディ(パース前)
 * @param signature 署名ヘッダ値
 * @param secret 署名シークレット
 * @param encoding 署名のエンコード("hex" | "base64"。既定 "hex")
 * @returns 署名が正当なら true。**必ず検証すること**(本人確認の結果を偽装されると、なりすましを許す)
 */
export function verifyEkycSignature(body: string, signature: string, secret: string, encoding: "hex" | "base64" = "hex"): boolean {
  const expected = createHmac("sha256", secret).update(body).digest(encoding);
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** 正規化された eKYC Webhook イベント。 */
export interface EkycWebhookEvent {
  /** ベンダー発行の申込 ID。 */
  applicationId?: string;
  /** 正規化ステータス。 */
  status: EkycStatus;
  /** 生のステータス文字列。 */
  rawStatus?: string;
  /** 却下理由等。 */
  reason?: string;
  /** イベント全体(ベンダー固有フィールドを参照する用)。 */
  raw: Record<string, unknown>;
}

/**
 * Webhook ボディをパースして正規化イベントにする。
 * フィールド名はベンダーで異なるため、抽出関数で調整できる(既定は一般的な名前を探す)。
 *
 * @param body リクエストボディ
 * @returns イベント。**解析できなくても例外を投げない**(status は `unknown` になる)。
 *
 * @remarks
 * webhook の入口で throw すると 500 が返り、**ベンダーがリトライを繰り返す**
 * (壊れたボディは何度送っても壊れている)。200 で受けてログに残すのが正しい。
 */
export function parseEkycWebhook(
  body: string,
  options?: {
    idField?: string;
    statusField?: string;
    reasonField?: string;
    statusMapping?: Record<string, EkycStatus>;
  },
): EkycWebhookEvent {
  // **例外を投げない。** webhook の入口で throw すると 500 が返り、
  // ベンダーがリトライを繰り返す(壊れたボディは何度送っても壊れている)。
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    raw = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }
  const pick = (obj: Record<string, unknown>, names: string[]): unknown => {
    for (const n of names) if (obj[n] !== undefined) return obj[n];
    return undefined;
  };
  const idField = options?.idField;
  const statusField = options?.statusField;
  const applicationId = (idField ? raw[idField] : pick(raw, ["application_id", "applicationId", "id", "verification_id"])) as string | undefined;
  const rawStatus = (statusField ? raw[statusField] : pick(raw, ["status", "result", "state"])) as string | undefined;
  const reason = (options?.reasonField ? raw[options.reasonField] : pick(raw, ["reason", "message", "detail"])) as string | undefined;
  return {
    ...(applicationId ? { applicationId } : {}),
    status: normalizeEkycStatus(rawStatus, options?.statusMapping),
    ...(rawStatus ? { rawStatus } : {}),
    ...(reason ? { reason } : {}),
    raw,
  };
}
