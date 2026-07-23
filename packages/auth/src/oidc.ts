/**
 * OIDC プロバイダ設定の抽象。
 * 実際の認証フロー(リダイレクト・コールバック・セッション発行)は
 * アプリ側の Auth.js 等が担う。ここでは主要 IdP の設定を型で標準化し、
 * アプリ間で設定形式がばらつかないようにする。
 *
 * @packageDocumentation
 */

/** サポートする IdP 種別。 */
export type OidcProviderKind = "entra" | "google" | "generic";

/** OIDC プロバイダ設定。 */
export interface OidcProviderConfig {
  kind: OidcProviderKind;
  clientId: string;
  clientSecret: string;
  /** generic の場合の発行者 URL(Entra/Google は kind から既知)。 */
  issuer?: string;
  /** Entra(Azure AD)のテナント ID。 */
  tenantId?: string;
}

/**
 * IdP 種別から issuer(発行者 URL)を解決する。
 * @param config プロバイダ設定
 * @returns issuer URL
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 未対応の IdP 種別、または custom で issuer 未指定の場合
 */
export function resolveIssuer(config: OidcProviderConfig): string {
  switch (config.kind) {
    case "google":
      return "https://accounts.google.com";
    case "entra":
      return `https://login.microsoftonline.com/${config.tenantId ?? "common"}/v2.0`;
    case "generic":
      if (!config.issuer) throw new Error("generic プロバイダには issuer が必要です");
      return config.issuer;
  }
}

/**
 * ID トークン(JWT)の中身。
 *
 * 名前は OIDC の標準に合わせてある。IdP によって入る項目が違うため、
 * **必須なのは iss / sub / aud / exp だけ**として扱う。
 */
export interface IdTokenClaims {
  /** 発行者。**必ず期待した IdP か確かめる**。 */
  iss: string;
  /** 利用者の一意な ID。**メールアドレスではなくこれで名寄せする**(メールは変わる)。 */
  sub: string;
  /** 宛先。**自分のクライアント ID か確かめる**。 */
  aud: string | string[];
  /** 失効時刻(秒)。 */
  exp: number;
  /** 発行時刻(秒)。 */
  iat?: number;
  /** リプレイ防止の値。認可要求時に送ったものと一致するか確かめる。 */
  nonce?: string;
  email?: string;
  /** メールが確認済みか。**未確認のメールで名寄せしない**。 */
  email_verified?: boolean;
  name?: string;
  /** Entra の場合のテナント ID。 */
  tid?: string;
  [key: string]: unknown;
}

/** 検証の失敗理由。画面には出さず、ログに残す用。 */
export type IdTokenFailure =
  | "malformed"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "expired"
  | "issued_in_future"
  | "nonce_mismatch"
  | "tenant_mismatch"
  | "email_unverified";

/** 検証結果。 */
export type IdTokenVerification =
  | { ok: true; claims: IdTokenClaims }
  | { ok: false; reason: IdTokenFailure };

/** 検証の条件。 */
export interface IdTokenVerifyOptions {
  /** 期待する発行者(`resolveIssuer` の戻り値)。 */
  issuer: string;
  /** 自分のクライアント ID。 */
  clientId: string;
  /** 認可要求時に送った nonce。 */
  nonce?: string;
  /** 自社テナントに限る場合の ID(Entra)。 */
  tenantId?: string;
  /** メール確認済みを必須にするか(既定 true)。 */
  requireVerifiedEmail?: boolean;
  /** 時計のずれの許容(秒。既定 60)。 */
  clockToleranceSeconds?: number;
  /** 現在時刻(秒。テスト用)。 */
  now?: () => number;
}

/**
 * ID トークンの**中身**を検証する。
 *
 * **署名の検証は別途必要**(IdP の公開鍵が要るため、この関数では行わない)。
 * ここが担うのは「署名が正しいトークンでも、**宛先や発行者が違えば拒否する**」部分。
 *
 * 署名だけ見て中身を見ないと、次の攻撃が通る:
 *   - **別のアプリ向けのトークンを流用される**(aud を見ていない)
 *   - **別のテナント・別の IdP のトークンを使われる**(iss を見ていない)
 *   - **期限切れのトークンを使い回される**(exp を見ていない)
 *
 * @param claims  署名検証済みのトークンの中身
 * @param options 期待する発行者・宛先など
 * @returns 検証結果(失敗理由は画面に出さずログへ)
 *
 * @example
 * ```ts
 * const v = verifyIdTokenClaims(claims, {
 *   issuer: resolveIssuer(config), clientId: config.clientId, nonce, tenantId: config.tenantId,
 * });
 * if (!v.ok) { logger.warn({ reason: v.reason }, "id token rejected"); return unauthorized(); }
 * ```
 */
export function verifyIdTokenClaims(
  claims: Partial<IdTokenClaims> | null | undefined,
  options: IdTokenVerifyOptions,
): IdTokenVerification {
  if (!claims || typeof claims.iss !== "string" || typeof claims.sub !== "string" || typeof claims.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (claims.iss !== options.issuer) return { ok: false, reason: "issuer_mismatch" };

  // aud は配列のこともある。自分のクライアント ID が含まれるかを見る
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(options.clientId)) return { ok: false, reason: "audience_mismatch" };

  const now = options.now ? options.now() : Math.floor(Date.now() / 1000);
  const skew = options.clockToleranceSeconds ?? 60;
  if (claims.exp + skew < now) return { ok: false, reason: "expired" };
  if (typeof claims.iat === "number" && claims.iat - skew > now) return { ok: false, reason: "issued_in_future" };

  if (options.nonce !== undefined && claims.nonce !== options.nonce) return { ok: false, reason: "nonce_mismatch" };

  // 自社テナントに限る設定なら、他社テナントのトークンを弾く
  if (options.tenantId && claims.tid !== undefined && claims.tid !== options.tenantId) {
    return { ok: false, reason: "tenant_mismatch" };
  }

  // 未確認のメールで名寄せすると、他人のアカウントに繋がりうる
  const requireVerified = options.requireVerifiedEmail ?? true;
  if (requireVerified && claims.email !== undefined && claims.email_verified === false) {
    return { ok: false, reason: "email_unverified" };
  }

  return { ok: true, claims: claims as IdTokenClaims };
}

/**
 * ID トークンから、社内で使う利用者の識別子を作る。
 *
 * **メールアドレスで名寄せしない。** 結婚や異動で変わるうえ、
 * 退職者のメールが再利用されると別人に繋がる。`iss` と `sub` の組で識別する。
 *
 * @param claims 検証済みのトークン
 * @returns `<発行者ホスト>:<sub>` の形の識別子
 */
export function subjectKey(claims: IdTokenClaims): string {
  let host = claims.iss;
  try {
    host = new URL(claims.iss).host;
  } catch {
    // URL でない発行者(まれ)はそのまま使う
  }
  return `${host}:${claims.sub}`;
}
