/**
 * パスキー / WebAuthn のサーバー側部品。
 * 登録・認証セレモニーのチャレンジ生成とオプション組み立て、および検証の要となる
 * clientDataJSON の検証、authenticatorData の解析、アサーション署名の検証を提供する。
 *
 * ⚠️ アテステーション証明書の検証や COSE 公開鍵の抽出(登録時)は CBOR 解析が必要で、
 * セキュリティ上も慎重を要するため、実運用では検証済みライブラリの併用を推奨する。
 * ここは依存ゼロで正しく提供できる範囲(チャレンジ/オプション/clientData/authData/署名検証)を担う。
 * @packageDocumentation
 */
import { randomBytes, createHash, verify as cryptoVerify } from "node:crypto";

/**
 * base64url エンコード。
 *
 * @param bytes バイト列
 * @returns Base64URL 文字列(WebAuthn の仕様で使う。`+/=` を含まない)
 */
export function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/**
 * base64url デコード → バイト列。
 *
 * @param text Base64URL 文字列
 * @returns バイト列
 */
export function fromBase64Url(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

/**
 * WebAuthn チャレンジ(base64url)を生成する。既定 32 バイト。
 *
 * @param length バイト長(既定 32)
 * @returns Base64URL のチャレンジ。**毎回新しく作り、セッションに保存して使い捨てる**(再利用は攻撃を許す)
 */
export function generateWebAuthnChallenge(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

/** 登録オプションの入力。 */
export interface RegistrationOptionsInput {
  /** RP(サービス)ID = 通常はドメイン。 */
  rpId: string;
  /** RP 表示名。 */
  rpName: string;
  /** ユーザー識別子(内部 ID)。 */
  userId: string;
  /** ユーザー名(ログイン ID)。 */
  userName: string;
  /** 表示名。 */
  userDisplayName?: string;
  /** チャレンジ(未指定なら生成)。 */
  challenge?: string;
  /** 既存クレデンシャル(重複登録防止)。 */
  excludeCredentialIds?: string[];
  /** ユーザー確認の要求(既定 "preferred")。 */
  userVerification?: "required" | "preferred" | "discouraged";
  /** タイムアウト(ミリ秒・既定 60000)。 */
  timeout?: number;
}

/**
 * * 登録用の PublicKeyCredentialCreationOptions(JSON 化可能な形)を組み立てる。
 * ブラウザの navigator.credentials.create() に渡す形の元データ。challenge は保存して検証時に照合する。
 *
 * @param params 利用者・RP(サービス)の情報
 * @returns ブラウザの `navigator.credentials.create()` に渡すオプション
 */
export function webAuthnRegistrationOptions(input: RegistrationOptionsInput): Record<string, unknown> {
  const challenge = input.challenge ?? generateWebAuthnChallenge();
  return {
    challenge,
    rp: { id: input.rpId, name: input.rpName },
    user: { id: toBase64Url(new TextEncoder().encode(input.userId)), name: input.userName, displayName: input.userDisplayName ?? input.userName },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },   // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: input.timeout ?? 60000,
    attestation: "none",
    excludeCredentials: (input.excludeCredentialIds ?? []).map((id) => ({ type: "public-key", id })),
    authenticatorSelection: { userVerification: input.userVerification ?? "preferred", residentKey: "preferred" },
  };
}

/** 認証オプションの入力。 */
export interface AuthenticationOptionsInput {
  rpId: string;
  challenge?: string;
  /** 許可するクレデンシャル ID(base64url)。空なら discoverable(パスキー)。 */
  allowCredentialIds?: string[];
  userVerification?: "required" | "preferred" | "discouraged";
  timeout?: number;
}

/**
 * 認証用の PublicKeyCredentialRequestOptions を組み立てる。
 *
 * @param params チャレンジと許可する認証器
 * @returns ブラウザの `navigator.credentials.get()` に渡すオプション
 */
export function webAuthnAuthenticationOptions(input: AuthenticationOptionsInput): Record<string, unknown> {
  const challenge = input.challenge ?? generateWebAuthnChallenge();
  return {
    challenge,
    rpId: input.rpId,
    timeout: input.timeout ?? 60000,
    userVerification: input.userVerification ?? "preferred",
    allowCredentials: (input.allowCredentialIds ?? []).map((id) => ({ type: "public-key", id })),
  };
}

/**
 * clientDataJSON をデコードして解析する。
 *
 * @param clientDataJSON ブラウザから返る clientDataJSON(Base64URL)
 * @returns 解析した内容(type / challenge / origin)
 */
export function decodeClientData(clientDataJSONBase64Url: string): { type: string; challenge: string; origin: string; crossOrigin?: boolean } {
  const json = new TextDecoder().decode(fromBase64Url(clientDataJSONBase64Url));
  return JSON.parse(json);
}

/** clientData 検証の結果。 */
export interface ClientDataVerification {
  valid: boolean;
  error?: string;
}

/**
 * * clientDataJSON を検証する(WebAuthn の中核チェック)。
 * type(登録/認証)・challenge(発行値と一致)・origin(自サイト)を確認する。
 *
 * @param clientData 解析済みの clientData
 * @param expected 期待する値(type / challenge / origin)
 * @returns すべて一致すれば true。**origin の検証を省くとフィッシングを許す**
 */
export function verifyClientData(
  clientDataJSONBase64Url: string,
  expected: { challenge: string; origin: string | string[]; type: "webauthn.create" | "webauthn.get" },
): ClientDataVerification {
  let data: ReturnType<typeof decodeClientData>;
  try {
    data = decodeClientData(clientDataJSONBase64Url);
  } catch {
    return { valid: false, error: "clientDataJSON の解析に失敗" };
  }
  if (data.type !== expected.type) return { valid: false, error: `type 不一致: ${data.type}` };
  if (data.challenge !== expected.challenge) return { valid: false, error: "challenge 不一致(リプレイの可能性)" };
  const origins = Array.isArray(expected.origin) ? expected.origin : [expected.origin];
  if (!origins.includes(data.origin)) return { valid: false, error: `origin 不一致: ${data.origin}` };
  return { valid: true };
}

/** authenticatorData のフラグ。 */
export interface AuthenticatorFlags {
  /** User Present(タッチ等)。 */
  userPresent: boolean;
  /** User Verified(生体・PIN)。 */
  userVerified: boolean;
  /** attested credential data 同梱(登録時)。 */
  attestedCredentialData: boolean;
  /** 拡張データあり。 */
  extensionData: boolean;
}

/** authenticatorData の解析結果。 */
export interface AuthenticatorData {
  /** rpId の SHA-256(先頭 32 バイト)。 */
  rpIdHash: Uint8Array;
  flags: AuthenticatorFlags;
  /** 署名カウンタ(クローン検知に使う)。 */
  signCount: number;
}

/**
 * authenticatorData(バイト列)を解析する。
 *
 * @param data authenticatorData のバイト列
 * @returns RP ID ハッシュ・フラグ・署名カウンタ
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — データが短すぎる場合
 */
export function parseAuthenticatorData(authData: Uint8Array): AuthenticatorData {
  if (authData.length < 37) throw new Error("authenticatorData が短すぎます");
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32]!;
  const signCount = (authData[33]! << 24) | (authData[34]! << 16) | (authData[35]! << 8) | authData[36]!;
  return {
    rpIdHash,
    flags: {
      userPresent: (flags & 0x01) !== 0,
      userVerified: (flags & 0x04) !== 0,
      attestedCredentialData: (flags & 0x40) !== 0,
      extensionData: (flags & 0x80) !== 0,
    },
    signCount: signCount >>> 0,
  };
}

/**
 * authenticatorData の rpIdHash が rpId と一致するか検証する。
 *
 * @param rpIdHash authenticatorData から取り出したハッシュ
 * @param rpId 期待する RP ID(ドメイン)
 * @returns 一致すれば true
 */
export function verifyRpIdHash(authData: Uint8Array, rpId: string): boolean {
  const expected = createHash("sha256").update(rpId).digest();
  const actual = parseAuthenticatorData(authData).rpIdHash;
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) return false;
  return true;
}

/**
 * 署名カウンタが進んだか(クローン検知)。stored 以下ならクローンの疑い。
 *
 * @param stored  前回保存した署名カウンタ
 * @param current 今回のカウンタ
 * @returns 増えていれば true。**減っていたら認証器の複製を疑う**(0 のままの認証器は例外的に許す)
 */
export function isSignCountValid(storedCount: number, newCount: number): boolean {
  // どちらも 0 の認証器(カウンタ未対応)は常に許容
  if (storedCount === 0 && newCount === 0) return true;
  return newCount > storedCount;
}

/**
 * * アサーション署名を検証する(認証時)。
 * 署名対象 = authenticatorData || SHA256(clientDataJSON)。登録時に保存した公開鍵(PEM)で検証する。
 * @param algorithm Node の verify に渡すアルゴリズム(ES256 は "sha256" を指定し鍵は EC)。
 *
 * @returns 署名が正しければ true
 */
export function verifyAssertionSignature(params: {
  publicKeyPem: string;
  authenticatorData: Uint8Array;
  clientDataJSONBase64Url: string;
  signatureBase64Url: string;
  algorithm?: string;
}): boolean {
  const clientDataHash = createHash("sha256").update(Buffer.from(fromBase64Url(params.clientDataJSONBase64Url))).digest();
  const signedData = Buffer.concat([Buffer.from(params.authenticatorData), clientDataHash]);
  try {
    return cryptoVerify(
      params.algorithm ?? "sha256",
      signedData,
      params.publicKeyPem,
      Buffer.from(fromBase64Url(params.signatureBase64Url)),
    );
  } catch {
    return false;
  }
}
