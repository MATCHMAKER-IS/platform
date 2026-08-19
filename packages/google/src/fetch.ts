/**
 * **タイムアウト付きの `fetch`**(Google API 用)。
 *
 * 2026-08 まで `impl ?? fetch` としており、**相手が応答しないと永久に待って**いた
 * ——Next.js のサーバ側ならそのリクエストが返らず、**利用者は白い画面のまま**になる。
 *
 * **10 秒**は `@platform/integrations` の共通クライアントと同じ既定。
 * Google API は普段 1 秒以内に返るので、10 秒待って返らなければ**異常**。
 *
 * 呼び出し側が `signal` を渡していればそちらを優先する。
 */
const GOOGLE_TIMEOUT_MS = 10_000;

/** タイムアウトを添えて `fetch` する。 * @param impl 差し替え用の `fetch`（省略時は組み込みのもの）
 * @returns **10 秒で切れる** `fetch`（呼び出し側が `signal` を渡していればそちらを優先）
 */
export function googleFetch(impl?: typeof fetch): typeof fetch {
  const base = impl ?? fetch;
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    base(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(GOOGLE_TIMEOUT_MS) })) as typeof fetch;
}
