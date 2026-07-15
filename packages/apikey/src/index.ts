/**
 * `@platform/apikey` — API キー / マシン間(M2M)認証。
 *
 * サービス間連携・外部システム向けの API キー発行・検証・スコープ制御を提供する。
 * キーは平文を保存せず、ハッシュ(SHA-256)で照合する。プレフィックスで種別・環境を判別可能。
 * 実際の保存・失効は注入ストアに委譲する。
 * @packageDocumentation
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** 生成したキー(平文は発行時の1回だけ返す)。 */
export interface GeneratedApiKey {
  /** 利用者へ渡す平文キー(例 "sk_live_ab12...")。保存しないこと。 */
  plaintext: string;
  /** DB に保存するハッシュ。 */
  hash: string;
  /** 検索・表示用のプレフィックス(例 "sk_live_ab12")。 */
  displayPrefix: string;
}

/** {@link generateApiKey} のオプション。 */
export interface GenerateApiKeyOptions {
  /** キーの接頭辞(例 "sk_live_")。種別・環境を表す。 */
  prefix?: string;
  /** ランダム部のバイト数(既定 24)。 */
  bytes?: number;
}

/** キーをハッシュ化する(保存・照合共通)。 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** API キーを生成する。平文は発行時のみ返し、DB にはハッシュを保存する。 */
export function generateApiKey(options: GenerateApiKeyOptions = {}): GeneratedApiKey {
  const { prefix = "sk_", bytes = 24 } = options;
  const random = randomBytes(bytes).toString("base64url");
  const plaintext = `${prefix}${random}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    displayPrefix: plaintext.slice(0, prefix.length + 4), // 先頭数文字だけ表示用に
  };
}

/** 平文キーと保存ハッシュを安全に照合する(タイミング攻撃対策)。 */
export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  const candidate = hashApiKey(plaintext);
  if (candidate.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

// ─────────────────────────── スコープ制御 ───────────────────────────

/**
 * 要求スコープが保有スコープで満たされるか判定する。
 * ワイルドカード対応: "orders:*" は "orders:read"/"orders:write" を包含。"*" は全許可。
 */
export function hasScope(granted: string[], required: string): boolean {
  if (granted.includes("*") || granted.includes(required)) return true;
  const [resource] = required.split(":");
  return granted.includes(`${resource}:*`);
}

/** 複数の要求スコープをすべて満たすか。 */
export function hasAllScopes(granted: string[], required: string[]): boolean {
  return required.every((r) => hasScope(granted, r));
}

// ─────────────────────────── 認証(ストア注入) ───────────────────────────

/** 保存済み API キーのレコード。 */
export interface ApiKeyRecord {
  id: string;
  hash: string;
  scopes: string[];
  /** 失効済みか。 */
  revoked?: boolean;
  /** 有効期限(epoch ms、任意)。 */
  expiresAt?: number;
}

/** キーの検索ストア(ハッシュから引く)。 */
export interface ApiKeyStore {
  findByHash(hash: string): Promise<ApiKeyRecord | null> | ApiKeyRecord | null;
}

/** 認証結果。 */
export type AuthResult =
  | { ok: true; record: ApiKeyRecord }
  | { ok: false; reason: "not_found" | "revoked" | "expired" };

/**
 * 平文キーを認証する。ハッシュで引き当て、失効・期限を確認する。
 * @param plaintext リクエストの API キー
 * @param store 検索ストア
 * @param now 現在時刻(テスト用)
 */
export async function authenticateApiKey(plaintext: string, store: ApiKeyStore, now: number = Date.now()): Promise<AuthResult> {
  const record = await store.findByHash(hashApiKey(plaintext));
  if (!record) return { ok: false, reason: "not_found" };
  if (record.revoked) return { ok: false, reason: "revoked" };
  if (record.expiresAt !== undefined && record.expiresAt <= now) return { ok: false, reason: "expired" };
  return { ok: true, record };
}
