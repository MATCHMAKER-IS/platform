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

/**
 * API キーをハッシュ化する(保存・照合の両方で使う)。
 *
 * @param key 平文のキー
 * @param secret pepper(**環境変数から**)
 * @returns ハッシュ
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * API キーを生成する。
 *
 * **平文は発行時にしか返らない**(DB にはハッシュだけ保存する)。
 * 利用者が紛失したら再発行しかない。**画面で「今だけ表示」と明示すること**。
 *
 * @param options.prefix 接頭辞(`sk_live_` など。**用途を見分けやすくする**)
 * @param options.secret pepper
 * @returns 平文のキー(**一度だけ**)と、保存するレコード
 */
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

/**
 * 平文のキーと保存ハッシュを照合する。
 *
 * **タイミング攻撃対策**(比較にかかる時間で正解の桁数を推測されないよう、
 * 定数時間で比較する)。素朴な `===` では漏れる。
 *
 * @param key 平文のキー
 * @param hash 保存されたハッシュ
 * @param secret pepper
 * @returns 一致すれば true
 */
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
 *
 * @param granted 付与されたスコープ
 * @param required 必要なスコープ
 * @returns 満たせば true(**ワイルドカード `*` に対応**)
 */
export function hasScope(granted: string[], required: string): boolean {
  if (granted.includes("*") || granted.includes(required)) return true;
  const [resource] = required.split(":");
  return granted.includes(`${resource}:*`);
}

/**
 * 要求されたスコープをすべて満たすかを判定する。
 *
 * @param granted 付与されたスコープ
 * @param required 必要なスコープ
 * @returns すべて満たせば true。**required が空なら true**(条件が無い = 通す)
 */
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
 * @returns 認証されたキー。**無効・失効・期限切れなら null**(理由は返さない。攻撃者に情報を与えない)
 */
export async function authenticateApiKey(plaintext: string, store: ApiKeyStore, now: number = Date.now()): Promise<AuthResult> {
  const record = await store.findByHash(hashApiKey(plaintext));
  if (!record) return { ok: false, reason: "not_found" };
  if (record.revoked) return { ok: false, reason: "revoked" };
  if (record.expiresAt !== undefined && record.expiresAt <= now) return { ok: false, reason: "expired" };
  return { ok: true, record };
}
