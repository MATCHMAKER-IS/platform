/**
 * ログイン系のレート制限(共有インスタンス)。
 * 実運用では Redis ストアに差し替え(createRedisStore)。
 * @packageDocumentation
 */
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit";

let loginLimiter: RateLimiter | null = null;

/** ログイン開始/コールバック用のリミッタ(IP 単位・1分5回)。 */
export function getLoginLimiter(): RateLimiter {
  if (!loginLimiter) {
    loginLimiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });
  }
  return loginLimiter;
}

/** リクエストからクライアント IP を推定する。 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

let apiKeyLimiter: RateLimiter | undefined;
/** APIキー単位のレート制限（既定 100 回/分）。外部向け v1 API 用。 */
export function getApiKeyLimiter(): RateLimiter {
  if (!apiKeyLimiter) apiKeyLimiter = createRateLimiter({ store: createMemoryStore(), limit: 100, windowSeconds: 60 });
  return apiKeyLimiter;
}

let ipLimiter: RateLimiter | undefined;
/** IP 単位の一般レート制限（既定 60 回/分）。 */
export function getIpLimiter(): RateLimiter {
  if (!ipLimiter) ipLimiter = createRateLimiter({ store: createMemoryStore(), limit: 60, windowSeconds: 60 });
  return ipLimiter;
}
