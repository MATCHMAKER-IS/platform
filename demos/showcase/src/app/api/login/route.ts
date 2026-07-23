// public-api: デモのログイン。ログイン前に呼ぶ
/** ログイン(デモ)。レート制限(@platform/guard)+ セッション発行(@platform/session)。 */
import { handleRoute } from "@platform/http";
import { AppError, ErrorCode } from "@platform/core";
import { enforceRateLimit } from "@platform/guard";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit";
import { session } from "../../../server/session";

// 本番は Redis ストア(createRedisStore)を使う。デモはメモリ。
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });

export const POST = handleRoute(async (req: Request) => {
  const { email } = (await req.json()) as { email?: string };
  if (!email) throw new AppError(ErrorCode.VALIDATION, "メールを入力してください");

  await enforceRateLimit(limiter, `login:${email}`); // 5回/分を超えると 429

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": session.write({ email, loginAt: Date.now() }) },
  });
});
