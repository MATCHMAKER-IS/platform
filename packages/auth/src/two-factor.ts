/**
 * 2 段階認証(2FA)の統合フロー。
 * TOTP(認証アプリ)・SMS OTP・バックアップコードの複数手段を 1 つの窓口で扱う。
 * ユーザーの登録状態(どの手段が有効か)を持ち、検証を適切な実装に振り分ける。純ロジック。
 * @packageDocumentation
 */
import { verifyTotp, type VerifyTotpOptions } from "./totp.js";
import { verifyOtpCode, type OtpChallenge } from "./otp.js";
import { verifyBackupCode, remainingBackupCodes, type BackupCodeRecord } from "./recovery-codes.js";

/** 2FA の手段。 */
export type TwoFactorMethod = "totp" | "sms" | "backup";

/** ユーザーの 2FA 登録状態(保存対象)。 */
export interface TwoFactorConfig {
  /** TOTP のシークレット(base32)。登録済みなら設定。 */
  totpSecret?: string;
  /** SMS 送信先(登録済みなら設定)。 */
  smsPhone?: string;
  /** 進行中の SMS OTP チャレンジ。 */
  smsChallenge?: OtpChallenge;
  /** バックアップコード(ハッシュ)。 */
  backupCodes?: BackupCodeRecord[];
}

/**
 * 有効化されている 2FA 手段を返す。
 *
 * @param state 利用者の 2 要素認証の設定
 * @returns 使える方式(totp / webauthn / backup)。**空なら 2 要素認証は未設定**
 */
export function availableMethods(config: TwoFactorConfig): TwoFactorMethod[] {
  const methods: TwoFactorMethod[] = [];
  if (config.totpSecret) methods.push("totp");
  if (config.smsPhone) methods.push("sms");
  if (config.backupCodes && config.backupCodes.length > 0) methods.push("backup");
  return methods;
}

/**
 * 2FA が有効か(いずれかの手段が登録済み)。
 *
 * @param state 利用者の設定
 * @returns 1 つでも方式が有効なら true
 */
export function isTwoFactorEnabled(config: TwoFactorConfig): boolean {
  return availableMethods(config).length > 0;
}

/** 2FA 検証の結果。 */
export interface TwoFactorVerifyResult {
  /** 認証成功か。 */
  verified: boolean;
  /** 使った手段。 */
  method?: TwoFactorMethod;
  /** 状態が更新された場合の新しい config(バックアップコード消費・SMS 試行加算)。保存し直す。 */
  config: TwoFactorConfig;
  /** 補足(残りのバックアップコード数など)。 */
  remainingBackupCodes?: number;
}

/**
 * * 指定手段で 2FA コードを検証する。
 * backup は使用済みにして残数を返し、sms は smsChallenge に対して検証・試行加算する。
 * @param secret サーバー側の pepper(SMS OTP / バックアップコードのハッシュ用)。TOTP には不要。
 *
 * @returns 検証結果と、更新した状態(バックアップコードの使用済みなど)
 */
export function verifyTwoFactor(
  config: TwoFactorConfig,
  method: TwoFactorMethod,
  code: string,
  options: { secret?: string; totpOptions?: VerifyTotpOptions; now?: Date } = {},
): TwoFactorVerifyResult {
  const now = options.now ?? new Date();
  switch (method) {
    case "totp": {
      if (!config.totpSecret) return { verified: false, config };
      const ok = verifyTotp(config.totpSecret, code, options.totpOptions ?? {}, now);
      return { verified: ok, method: "totp", config };
    }
    case "sms": {
      if (!config.smsChallenge || !options.secret) return { verified: false, config };
      const result = verifyOtpCode(config.smsChallenge, code, options.secret, now);
      // 試行加算/成功を反映
      const nextConfig: TwoFactorConfig = { ...config, smsChallenge: result.status === "ok" ? undefined : result.challenge };
      return { verified: result.status === "ok", method: "sms", config: nextConfig };
    }
    case "backup": {
      if (!config.backupCodes || !options.secret) return { verified: false, config };
      const result = verifyBackupCode(code, config.backupCodes, options.secret, now);
      const nextConfig: TwoFactorConfig = { ...config, backupCodes: result.records };
      return {
        verified: result.valid,
        method: "backup",
        config: nextConfig,
        remainingBackupCodes: remainingBackupCodes(result.records),
      };
    }
    default:
      return { verified: false, config };
  }
}

/**
 * * 手段を指定せず、複数手段を順に試して検証する(ユーザーがどの手段のコードを入れたか不明なとき)。
 * TOTP → バックアップの順で試す(SMS はチャレンジ前提のため明示指定を推奨)。
 *
 * @param state 利用者の設定
 * @param input 入力(方式と値)
 * @param secret pepper
 * @param now 現在時刻(テスト注入用)
 * @returns どの方式で成功したかと、更新した状態
 */
export function verifyAnyTwoFactor(
  config: TwoFactorConfig,
  code: string,
  options: { secret?: string; totpOptions?: VerifyTotpOptions; now?: Date; methods?: TwoFactorMethod[] } = {},
): TwoFactorVerifyResult {
  const order = options.methods ?? (["totp", "backup"] as TwoFactorMethod[]);
  let current = config;
  for (const method of order) {
    const result = verifyTwoFactor(current, method, code, options);
    if (result.verified) return result;
    current = result.config;
  }
  return { verified: false, config: current };
}
