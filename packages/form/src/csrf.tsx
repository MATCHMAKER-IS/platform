"use client";
/**
 * CSRF のクライアント側ヘルパー。cookie のトークンを読み、送信に載せる。
 * サーバ側の発行・検証は `@platform/security` を使う。
 * @packageDocumentation
 */
import * as React from "react";

/** cookie から CSRF トークンを読む(既定 cookie 名 "csrf")。 */
export function readCsrfToken(cookieName = "csrf"): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

/** CSRF トークンを cookie から購読するフック。 */
export function useCsrfToken(cookieName = "csrf"): string | null {
  const [token, setToken] = React.useState<string | null>(null);
  React.useEffect(() => setToken(readCsrfToken(cookieName)), [cookieName]);
  return token;
}

/** fetch に付与する CSRF ヘッダを返す。 */
export function csrfHeaders(token: string | null, headerName = "x-csrf-token"): Record<string, string> {
  return token ? { [headerName]: token } : {};
}

/** フォームに CSRF トークンを隠しフィールドとして埋め込む(サーバがボディから読む場合)。 */
export function CsrfField({ cookieName = "csrf", name = "csrfToken" }: { cookieName?: string; name?: string }) {
  const token = useCsrfToken(cookieName);
  return <input type="hidden" name={name} value={token ?? ""} readOnly />;
}
