/**
 * 書き込みの回数制限。
 *
 * 【なぜ雛形に入れるか】
 * **どのアプリでも必ず要る。** 認証があっても、
 * 正規の利用者がスクリプトで叩けば同じことが起きる。
 * 誤ったループ、リトライの暴走、いたずら — いずれも
 * 「1 分に何回まで」を決めておけば被害が小さくなる。
 *
 * 【なぜ読み取りは制限しないか】
 * 読むだけなら副作用が無く、遅くなるだけで済む。
 * **書き込みは戻すのに手間がかかる**ので、そちらを守る。
 *
 * 【本番では差し替える】
 * メモリ実装なので、**複数インスタンスでは各々が別に数える**。
 * 実運用では Redis 実装(`createRedisStore`)を注入する。
 * @packageDocumentation
 */
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit/browser";

let limiter: RateLimiter | undefined;

/**
 * 書き込み用の制限を返す。
 *
 * **1 分に 30 回**。人が画面から操作する限り届かない数で、
 * スクリプトの暴走は止まる。
 *
 * @returns 回数制限
 */
export function getWriteLimiter(): RateLimiter {
  limiter ??= createRateLimiter({ store: createMemoryStore(), limit: 30, windowSeconds: 60 });
  return limiter;
}

/**
 * 接続元を特定する鍵を作る。
 *
 * **利用者と接続元の両方**で数える。
 * - 利用者だけだと、ログイン前の口を守れない
 * - 接続元だけだと、同じ事務所の全員が巻き添えになる
 *
 * @param req 要求
 * @param userId ログイン中の利用者(未ログインなら undefined)
 * @returns 制限の鍵
 */
export function rateLimitKey(req: Request, userId?: string): string {
  // プロキシ越しは `x-forwarded-for` の先頭が元の接続元
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "unknown";
  return userId !== undefined ? `user:${userId}` : `ip:${ip}`;
}
