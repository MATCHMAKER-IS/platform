/**
 * ログイン系のレート制限(共有インスタンス)。
 * 実運用では Redis ストアに差し替え(createRedisStore)。
 * @packageDocumentation
 */
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit/browser";
import { getCookie } from "@platform/session";

let loginLimiter: RateLimiter | null = null;

/** ログイン開始/コールバック用のリミッタ(IP 単位・1分5回)。 */
export function getLoginLimiter(): RateLimiter {
  if (!loginLimiter) {
    loginLimiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });
  }
  return loginLimiter;
}

/** リクエストからクライアント IP を推定する。 */
// **基盤に一本化した**（2026-08）。同じ 3 行が 10 か所に散っていたため。
// ここは**再エクスポートだけ**——呼ぶ側の import を変えずに済ませる
export { clientIp } from "@platform/guard";
// このファイルの中でも使うので import も要る（再エクスポートだけでは足りない）
import { clientIp } from "@platform/guard";

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

let secretLimiter: RateLimiter | undefined;

/**
 * **秘密を当てにいける口**のための制限器(5 回 / 分)。
 *
 * **`getIpLimiter`(60 回 / 分)では緩すぎます。** 共有鍵や初期セットアップは
 * **1 回でも当てられたら終わり**なので、正常な利用に必要な回数だけを通します:
 *
 * | 口 | 正常な利用 |
 * |---|---|
 * | `setup/bootstrap` | **一生に 1 回**(最初の管理者を作るだけ) |
 * | `balance/collect` | **1 日数回**(定期実行) |
 *
 * ログイン(`getLoginLimiter`)と同じ 5 回 / 分にしてあります——
 * **同じ性質のものは同じ厳しさにする**(片方だけ緩いと、そこが狙われます)。
 */
export function getSecretLimiter(): RateLimiter {
  if (!secretLimiter) {
    secretLimiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });
  }
  return secretLimiter;
}

let writeLimiter: RateLimiter | undefined;

/**
 * 書き込み用の回数制限。
 *
 * **1 分に 60 回。** 人が画面から操作する限り届かない数で、
 * スクリプトの暴走は止まる。
 * ログイン(5 回/分)より緩いのは、**正規の操作を邪魔しない**ため。
 *
 * @returns 回数制限
 */
export function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ store: createMemoryStore(), limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

/**
 * 制限の単位を決める鍵。
 *
 * **利用者と接続元の両方**で数える。
 * - 利用者だけだと、ログイン前の口を守れない
 * - 接続元だけだと、同じ事務所の全員が巻き添えになる
 *
 * @param req 要求
 * @returns 鍵
 */
export function writeLimitKey(req: Request): string {
  const session = getCookie(req.headers.get("cookie"), "session");
  if (session !== null) {
    // **セッションそのものは鍵にしない**(ログに残ると盗まれる)。
    // 先頭だけで十分に分かれる
    return `s:${session.slice(0, 16)}`;
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "unknown";
  return `ip:${ip}`;
}

/**
 * **認証を通さない API を、回数で守る。**
 *
 * 認可が無い口は、**回数で守るしかありません**——
 * 総当たり・踏み台・単純な連打で落とされるのを防ぎます。
 *
 * 超過したら `429` の `Response` を返します。**通ってよければ `null`**。
 *
 * **制限器が落ちたときは既定で通します(fail-open)。** 守りのために本業が止まっては
 * 本末転倒だからです——`@platform/guard` の `guardWrite` と同じ判断。
 *
 * **ただし「認証が存在しない口」は逆にしてください**(`onStoreError: "deny"`)。
 * 制限が消えた状態で総当たりを許すと、**攻撃者は制限器を落とすだけで防御を外せます**。
 * 「一時的に使えない」方が「誰でも突破できる」より軽い、という判断です
 * (`enforceRateLimit` の `onStoreError` と同じ考え方)。
 *
 * @param req 要求
 * @param bucket 何の口かを表す短い名前（`vitals` など）。**口ごとに分けて数える**
 * @param options.limiter 使う制限器（既定は IP 単位・60 回/分）
 * @param options.onStoreError 制限器が落ちたときの扱い（既定 `"allow"`）。
 *   **認証が存在しない口では `"deny"`**
 * @returns 超過なら 429 の応答、通ってよければ null
 *
 * @example
 * ```ts
 * // public-api: ログイン前の画面からも送られる
 * async function handlePOST(req: Request): Promise<Response> {
 *   const limited = await limitPublic(req, "vitals");
 *   if (limited) return limited;
 *   // …
 * }
 * ```
 */
export async function limitPublic(
  req: Request,
  bucket: string,
  options: { limiter?: RateLimiter; onStoreError?: "allow" | "deny" } = {},
): Promise<Response | null> {
  const limiter = options.limiter ?? getIpLimiter();
  const rl = await limiter.check(`${bucket}:${clientIp(req)}`);
  if (!rl.ok) {
    // **既定は通す(fail-open)。** 制限器(将来 Redis)が落ちたときに
    // 業務まで止めるのは行き過ぎ
    if ((options.onStoreError ?? "allow") === "allow") return null;
    // **認証が存在しない口は通さない。** 制限が消えた状態で総当たりを許すと、
    // **制限器を落とすだけで防御を外せます**
    return Response.json(
      { error: "現在この操作は受け付けられません。しばらく待ってからお試しください" },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }
  if (rl.value.allowed) return null;
  // **`Retry-After` を返す。** 何秒待てばよいか分からないと、
  // 呼ぶ側は即座に再試行して、さらに詰まる。
  // ウィンドウは 60 秒なので、最大でもその長さ
  return Response.json(
    { error: "アクセスが多すぎます。しばらく待ってからお試しください" },
    {
      status: 429,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": String(rl.value.limit),
        "X-RateLimit-Remaining": String(rl.value.remaining),
      },
    },
  );
}
