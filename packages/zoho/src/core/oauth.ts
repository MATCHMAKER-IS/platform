/**
 * Zoho OAuth: リフレッシュトークンからアクセストークンを更新する。
 * @packageDocumentation
 */
import { accountsUrl, type ZohoDataCenter } from "./datacenter.js";

/** 更新結果。 */
export interface TokenResult { accessToken: string; apiDomain: string; expiresIn: number }

/**
 * リフレッシュトークンでアクセストークンを更新する。
 *
 * **アクセストークンは 1 時間で切れる**ので、長時間の処理では更新が要る。
 * 通常は {@link createTokenManager} が自動で行うので、直接呼ぶ場面は少ない。
 *
 * @param refreshToken リフレッシュトークン
 * @param config クライアント ID・シークレット・DC
 * @param fetchImpl fetch の実装(テスト注入用)
 * @returns 新しいアクセストークン
 */
export async function refreshAccessToken(config: {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; value: TokenResult } | { ok: false; error: string }> {
  const doFetch = config.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });
  try {
    const res = await doFetch(`${accountsUrl(config.dataCenter)}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return { ok: false, error: `トークン更新に失敗しました: ${res.status}` };
    const json = (await res.json()) as { access_token?: string; api_domain?: string; expires_in?: number; error?: string };
    if (json.error || !json.access_token) return { ok: false, error: json.error ?? "access_token が返りませんでした" };
    return { ok: true, value: { accessToken: json.access_token, apiDomain: json.api_domain ?? `https://www.zohoapis.${config.dataCenter}`, expiresIn: json.expires_in ?? 3600 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
