/**
 * ワンタイムパスワード(OTP)による認証。SMS・メール等で送る数字コードの
 * 生成・検証・試行制限・有効期限・再送クールダウンを扱う。
 * コードは平文で保存せず HMAC ハッシュで保持し、検証は定数時間比較で行う。
 * チャネル非依存(送信は @platform/sms や @platform/mail で行う)。
 * @packageDocumentation
 */
import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

/** 保存・やり取りする OTP チャレンジ(シリアライズ可能)。 */
export interface OtpChallenge {
  /** チャレンジ ID。 */
  id: string;
  /** 送信先の識別子(電話番号やメール)。 */
  identifier: string;
  /** コードの HMAC ハッシュ(平文は保持しない)。 */
  codeHash: string;
  /** 有効期限(エポックミリ秒)。 */
  expiresAt: number;
  /** これまでの検証試行回数。 */
  attempts: number;
  /** 許容する最大試行回数。 */
  maxAttempts: number;
  /** 発行時刻(エポックミリ秒。再送クールダウン判定に使う)。 */
  createdAt: number;
}

/**
 * 指定桁数の暗号学的に安全な数字コードを生成する。
 *
 * `Math.random()` は**使わない**(予測可能で、認証コードには不適)。
 *
 * @param length 桁数(既定 6)
 * @returns 数字のみの文字列(先頭が 0 になることもある)
 */
export function generateOtpCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) code += randomInt(0, 10).toString();
  return code;
}

/**
 * コードを HMAC-SHA256 でハッシュする。
 *
 * **平文のコードを保存しない**ため。identifier を混ぜることで、
 * 別ユーザーの challenge に同じコードを使い回せないようにする。
 *
 * @param code       OTP コード
 * @param secret     サーバー側の pepper(環境変数などから。**コードに直書きしない**)
 * @param identifier 用途を分ける識別子(メールアドレス・電話番号など)
 * @returns 16 進のハッシュ文字列
 */
export function hashOtpCode(code: string, secret: string, identifier = ""): string {
  return createHmac("sha256", secret).update(`${identifier}:${code}`).digest("hex");
}

/** {@link createOtpChallenge} のオプション。 */
export interface CreateOtpOptions {
  /** コード桁数(既定 6)。 */
  length?: number;
  /** 有効期間(秒。既定 300=5分)。 */
  ttlSec?: number;
  /** 最大試行回数(既定 5)。 */
  maxAttempts?: number;
  /** ID 生成関数(既定はランダム)。 */
  generateId?: () => string;
  /** 現在時刻(テスト用)。 */
  now?: Date;
}

/**
 * OTP チャレンジを新規作成する。
 * 返り値の `code` を SMS/メールで送信し、`challenge` を保存する(コードは challenge に平文で入らない)。
 *
 * @param identifier 送信先の識別子(メールアドレス・電話番号)
 * @param secret     ハッシュ用の pepper
 * @param options    桁数・有効期限・最大試行回数(省略時は既定)
 * @returns `challenge`(保存する)と `code`(送信する)。**code は保存しない**
 */
export function createOtpChallenge(identifier: string, secret: string, options: CreateOtpOptions = {}): { challenge: OtpChallenge; code: string } {
  const length = options.length ?? 6;
  const ttlSec = options.ttlSec ?? 300;
  const maxAttempts = options.maxAttempts ?? 5;
  const now = (options.now ?? new Date()).getTime();
  const code = generateOtpCode(length);
  const challenge: OtpChallenge = {
    id: options.generateId ? options.generateId() : generateOtpCode(16),
    identifier,
    codeHash: hashOtpCode(code, secret, identifier),
    expiresAt: now + ttlSec * 1000,
    attempts: 0,
    maxAttempts,
    createdAt: now,
  };
  return { challenge, code };
}

/** OTP 検証の結果ステータス。 */
export type OtpVerifyStatus = "ok" | "invalid" | "expired" | "too_many_attempts";

/** OTP 検証の結果。challenge は試行回数を更新した新しい状態。 */
export interface OtpVerifyResult {
  status: OtpVerifyStatus;
  challenge: OtpChallenge;
}

/**
 * OTP コードを検証する(定数時間比較)。
 * 期限切れ・試行超過・不一致を区別して返し、試行回数を加算した challenge を返す。
 * 成功後は challenge を破棄(再利用不可)にすること。
 *
 * @param challenge 保存してある challenge
 * @param code      利用者が入力したコード
 * @param secret    作成時と同じ pepper
 * @param now       現在時刻(テスト注入用)
 * @returns 判定結果と、試行回数を加算した challenge
 */
export function verifyOtpCode(challenge: OtpChallenge, code: string, secret: string, now: Date = new Date()): OtpVerifyResult {
  const t = now.getTime();
  if (challenge.attempts >= challenge.maxAttempts) {
    return { status: "too_many_attempts", challenge };
  }
  if (t > challenge.expiresAt) {
    return { status: "expired", challenge };
  }
  const updated: OtpChallenge = { ...challenge, attempts: challenge.attempts + 1 };
  const expected = challenge.codeHash;
  const actual = hashOtpCode(code, secret, challenge.identifier);
  let match = false;
  try {
    match = expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    match = false;
  }
  if (match) return { status: "ok", challenge: updated };
  // 試行超過に達したら次回以降はロック
  if (updated.attempts >= updated.maxAttempts) return { status: "too_many_attempts", challenge: updated };
  return { status: "invalid", challenge: updated };
}

/**
 * 再送してよいかを判定する(連打による SMS 費用と迷惑を防ぐ)。
 *
 * @param challenge   前回の challenge(createdAt を見る)
 * @param cooldownSec クールダウン秒
 * @param now         現在時刻(テスト注入用)
 * @returns 再送してよいなら true
 */
export function canResendOtp(challenge: Pick<OtpChallenge, "createdAt">, cooldownSec: number, now: Date = new Date()): boolean {
  return now.getTime() - challenge.createdAt >= cooldownSec * 1000;
}

/**
 * 次に再送できるまでの残り秒を返す(画面のカウントダウン表示に使う)。
 *
 * @param challenge   前回の challenge
 * @param cooldownSec クールダウン秒
 * @param now         現在時刻(テスト注入用)
 * @returns 残り秒。0 なら今すぐ再送できる
 */
export function resendWaitSeconds(challenge: Pick<OtpChallenge, "createdAt">, cooldownSec: number, now: Date = new Date()): number {
  const elapsed = (now.getTime() - challenge.createdAt) / 1000;
  return Math.max(0, Math.ceil(cooldownSec - elapsed));
}
