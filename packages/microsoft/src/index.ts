/**
 * `@platform/microsoft` — Microsoft 365 / Entra ID 連携。
 *
 * 提供するもの:
 *   - Entra ID の OAuth(認可 URL の組み立て・トークンの取得と自動更新)
 *   - Microsoft Graph の最小クライアント(メール送信・予定・利用者)
 *
 * 社内で Microsoft 365 を使っているなら、**認証も Entra に任せられる**。
 * その場合 2 要素認証やパスワード再設定は Entra 側の手続きになる(ADR 0016)。
 *
 * テナントは必ず**自社の ID** を指定すること。`common` にすると
 * 他社のアカウントでもログインできてしまう。
 * @packageDocumentation
 */
export * from "./oauth";
export * from "./graph";
