// public-api: デモ用。パスワードの強度を判定するだけで保存しない
/**
 * パスワード API。生成と強度判定を基盤(@platform/crypto)で行う。
 * crypto は node:crypto に依存するためサーバ側でのみ実行する。
 */
import { handleRoute } from "@platform/http";
// **パスワード変更は総当たりの入口。** 試行回数を絞らないと、
// 弱いパスワードは時間さえかければ必ず破られる。
import { checkRateLimit, clientIp } from "../../../server/rate-limit";
import { generatePassword, passwordStrength } from "@platform/crypto";
import { validate, z } from "@platform/validation";

// **length に上限を設ける。** 制限が無いと極端な値を渡せた。
const GenerateInput = z.object({ length: z.coerce.number().int().min(8).max(128).default(16) });
const StrengthInput = z.object({ password: z.string().max(1000) });

// GET /api/password?length=20 → 生成
export const GET = handleRoute(async (req: Request) => {
  const parsed = validate(GenerateInput, { length: new URL(req.url).searchParams.get("length") ?? undefined });
  const length = parsed.ok ? parsed.value.length : 16;
  return Response.json({ password: generatePassword({ length }) });
});

// POST /api/password { password } → 強度判定
export const POST = handleRoute(async (req: Request) => {
  // **IP で数える。** メールが分かる時点ではまだ本文を読んでいないため。
  const limited = await checkRateLimit([`パスワード変更:${clientIp(req)}`]);
  if (limited) return limited;

  const parsed = validate(StrengthInput, await req.json().catch(() => ({})));
  const password = parsed.ok ? parsed.value.password : "";
  return Response.json(passwordStrength(password));
});
