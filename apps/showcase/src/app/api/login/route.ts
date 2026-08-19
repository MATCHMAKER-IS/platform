// public-api: デモのログイン。ログイン前に呼ぶ
/** ログイン(デモ)。レート制限(@platform/guard)+ セッション発行(@platform/session)。 */
import { handleRoute } from "@platform/http";
// **ログインは総当たりの入口。** 試行回数を絞らないと、
// 弱いパスワードは時間さえかければ必ず破られる。
import { checkRateLimit, clientIp } from "../../../server/rate-limit";
import { AppError, ErrorCode } from "@platform/core";
import { enforceRateLimit } from "@platform/guard";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
import { session } from "../../../server/session";
import { validate, z } from "@platform/validation";

// **メール形式を確認する。** これまでは空文字チェックのみで、
// 形の崩れた値がそのままセッションの中身(email)に入っていた。
const LoginInput = z.object({ email: z.string().trim().email("メールアドレスの形式で指定してください") });

// 本番は Redis ストア(createRedisStore)を使う。デモはメモリ。
const limiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });

export const POST = handleRoute(async (req: Request) => {
  // **IP で数える。** メールが分かる時点ではまだ本文を読んでいないため。
  const limited = await checkRateLimit([`ログイン:${clientIp(req)}`]);
  if (limited) return limited;

  const parsed = validate(LoginInput, await req.json().catch(() => ({})));
  if (!parsed.ok) throw new AppError(ErrorCode.VALIDATION, parsed.error.message);
  const { email } = parsed.value;

  // **ストア障害時は止める。** 既定(通す)のままだと、
  // **Redis を落とせば総当たりの防御が消える**——攻撃者に無効化される。
  // 「ログインできない」方が「誰でも入れる」より軽い(2026-08)
  await enforceRateLimit(limiter, `login:${email}`, { onStoreError: "deny" }); // 5回/分を超えると 429

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": session.write({ email, loginAt: Date.now() }) },
  });
});
