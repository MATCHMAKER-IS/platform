// public-api: 見本用。eKYC Webhook の署名検証をサーバで行う
/**
 * eKYC Webhook の**署名検証**の見本用 API。
 *
 * 【なぜ画面から呼ばないか】
 * HMAC（`node:crypto`）を使うのでブラウザでは動きません。
 * それ以前に——**署名の秘密を画面に置いてはいけません**。
 * 画面に置いた時点で、**誰でも「正しい署名」を作れます**。
 *
 * 解析（`parseEkycWebhook`）は文字列を読むだけなので画面に残しています
 * （`@platform/ekyc/webhook-parse`）。
 * **同じ Webhook の処理でも、検証と解析は置く場所が違います。**
 */
import { verifyEkycSignature } from "@platform/ekyc";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";
import { validate, z } from "@platform/validation";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

/**
 * 呼び出しの上限。
 *
 * **署名を当てにいける口です。** 回数を絞らないと総当たりに使えます。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 20,
  windowSeconds: 60,
  // **制限器が落ちたら通さない（fail-close）。**
  // 秘密の一致で通す口では、「一時的に使えない」方が
  // 「一時的に誰でも通る」よりはるかに軽い
  onStoreError: "deny",
});

const Input = z.object({
  body: z.string().max(20_000),
  signature: z.string().max(500),
  /** **見本なので受け取っています。** 実運用では環境変数から読みます。 */
  secret: z.string().max(200),
  encoding: z.enum(["hex", "base64"]).default("hex"),
});

async function handlePOST(req: Request): Promise<Response> {
  const rl = await limiter.check(`ekyc-demo:${clientIp(req)}`);
  if (!rl.ok || !rl.value.allowed) {
    return Response.json(
      { error: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = validate(Input, await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ error: "本文の形が正しくありません" }, { status: 400 });
  const { body, signature, secret, encoding } = parsed.value;

  return Response.json({ verified: verifyEkycSignature(body, signature, secret, encoding) });
}

export const POST = handleRoute(handlePOST);
