/**
 * ソーシャルログインの補助ロジック(純ロジック・React 非依存)。
 * プロバイダ一覧と、どの基盤パッケージで認証するかの対応。UI と認証層をつなぐ参考情報。
 * @packageDocumentation
 */

/** 対応プロバイダ。 */
export type SocialProvider = "google" | "zoho" | "microsoft" | "github" | "apple" | "line";

/** プロバイダの表示名。 */
export const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  zoho: "Zoho",
  microsoft: "Microsoft",
  github: "GitHub",
  apple: "Apple",
  line: "LINE",
};

/**
 * ボタン表示ラベルを組み立てる(例「Google でログイン」)。
 *
 *
 * @param provider プロバイダ
 * @returns 表示名(**各社のブランド表記に合わせる**。『Googleでログイン』は規約で表記が決まっている)
 */
export function socialLoginLabel(provider: SocialProvider, action = "ログイン"): string {
  return `${PROVIDER_LABELS[provider]} で${action}`;
}

/** どの基盤で認証を実装するかの推奨対応。 */
export const PROVIDER_AUTH_BACKEND: Record<SocialProvider, string> = {
  google: "@platform/google (buildGoogleAuthUrl)",
  zoho: "@platform/zoho",
  microsoft: "@platform/auth (OIDC: entra)",
  github: "@platform/auth (OIDC: generic)",
  apple: "@platform/auth (OIDC: generic)",
  line: "@platform/auth (OIDC: generic)",
};
