/**
 * 公開 API のレート制限（共有インスタンス）。
 *
 * **認証まわりは総当たりの入口**である。試行回数を絞らないと、
 * 弱いパスワードは時間さえかければ必ず破られる。
 *
 * **本番では Redis ストアに差し替える。** メモリのままだと
 * インスタンスが複数あるとき各々が別に数え、**上限が台数倍**になる
 * （3 台なら 1 分 15 回まで通ってしまう）。
 * @packageDocumentation
 */
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit";

let authLimiter: RateLimiter | null = null;

/**
 * 認証まわりのリミッタ（1 分 5 回）。
 *
 * ログイン・登録・パスワード変更で共有する。
 */
export function getAuthLimiter(): RateLimiter {
  if (!authLimiter) {
    authLimiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });
  }
  return authLimiter;
}

/** リクエストから接続元 IP を推定する。 */
// **基盤に一本化した**（2026-08）。同じ 3 行が 10 か所に散っていたため。
// ここは**再エクスポートだけ**——呼ぶ側の import を変えずに済ませる
export { clientIp } from "@platform/guard";

/**
 * **`checkRateLimit` という名前にしてある。**
 * `check-safety-parts` の被覆検査がこの語を探すため——
 * 独自名（以前は `tooManyAttempts`）だと「実装したのに未実装と数えられる」
 * ことが 2026-08 に起きた。**検査が探す語彙に合わせるのも設計の一部**。
 *
 * 上限に達していれば 429 を返す（達していなければ `null`）。
 *
 * **ストア障害のときは通す（fail-open）。** ここで全員を締め出すと、
 * 復旧作業のための管理画面にも入れなくなる。
 *
 * @param keys 数える単位（IP とメールなど**複数を併用する**）。
 *   IP だけだと共有回線でまとめて弾かれ、メールだけだと
 *   大量のアドレスを試されたときに素通りする。
 */
export async function checkRateLimit(keys: readonly string[]): Promise<Response | null> {
  const limiter = getAuthLimiter();
  for (const key of keys) {
    const gate = await limiter.check(key);
    if (gate.ok && !gate.value.allowed) {
      return Response.json(
        { error: "試行回数の上限に達しました。しばらくしてからお試しください" },
        { status: 429 },
      );
    }
  }
  return null;
}
