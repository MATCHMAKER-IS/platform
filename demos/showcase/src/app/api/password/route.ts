// public-api: デモ用。パスワードの強度を判定するだけで保存しない
/**
 * パスワード API。生成と強度判定を基盤(@platform/crypto)で行う。
 * crypto は node:crypto に依存するためサーバ側でのみ実行する。
 */
import { handleRoute } from "@platform/http";
import { generatePassword, passwordStrength } from "@platform/crypto";

// GET /api/password?length=20 → 生成
export const GET = handleRoute(async (req: Request) => {
  const length = Number(new URL(req.url).searchParams.get("length") ?? 16);
  return Response.json({ password: generatePassword({ length }) });
});

// POST /api/password { password } → 強度判定
export const POST = handleRoute(async (req: Request) => {
  const { password } = (await req.json()) as { password: string };
  return Response.json(passwordStrength(password ?? ""));
});
