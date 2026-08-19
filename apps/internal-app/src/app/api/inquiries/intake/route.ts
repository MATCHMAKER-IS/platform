// public-api: 社外からの問い合わせ受付(公開フォーム)。レート制限で保護する
/** お問い合わせ: 匿名インテーク(POST)。公開サイトのフォームから受け付ける。X-Intake-Token で保護。 */
import { withApiObservability } from "../../../../server/instrument";
// **公開の受付口なので回数で守る。** 認証が無い API を無制限に叩かせると、
// 総当たりと踏み台に使われる(`check-safety-parts` が見張っている)。
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit";
import { inquiryStore } from "../../../../server/platform-services";
import { isValidEmail } from "@platform/mail";
import { featureEnv } from "../../../../server/env";

/**
 * 受け取る本文の上限(バイト)。
 *
 * **100KB。** 問い合わせの文面としては十分すぎる。
 * ここは**社外に開いた口**なので、社内向け(1MB)より厳しくする。
 */
const MAX_BODY_BYTES = 100_000;

let limiter: RateLimiter | undefined;

/**
 * 回数制限。
 *
 * **1 分に 5 回。** 社外に開いているので厳しめ。
 * 人が問い合わせを送る限り届かず、いたずらや自動送信は止まる。
 *
 * 冒頭のコメントは「レート制限で保護する」と書いていたが、
 * **実装が無かった**(2026-08 に気づいた)。
 */
function getLimiter(): RateLimiter {
  limiter ??= createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 60 });
  return limiter;
}

async function handlePOST(req: Request): Promise<Response> {
  // **本文の大きさ。** 解析の前に止める
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return Response.json({ error: "内容が長すぎます。" }, { status: 413 });
  }

  // **接続元で数える。** ログイン前なので利用者を特定できない
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "unknown";
  const hit = await getLimiter().check(`intake:${ip}`);
  // ストアが落ちたら通す(問い合わせを受けられない方が困る)
  if (hit.ok && !hit.value.allowed) {
    return Response.json(
      { error: "送信が続いています。しばらくしてからお試しください。" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const token = featureEnv.INQUIRY_INTAKE_TOKEN;
  if (!token || req.headers.get("x-intake-token") !== token) return Response.json({ error: "不正なリクエストです" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; category?: string; subject?: string; message?: string };
  if (!body.name || !body.email || !body.subject || !body.message) return Response.json({ error: "氏名・メール・件名・本文は必須です" }, { status: 400 });
  if (!isValidEmail(body.email)) return Response.json({ error: "メールアドレスが不正です" }, { status: 400 });
  const inquiry = await inquiryStore.submit({ name: body.name, email: body.email, category: body.category || "公開サイト", subject: body.subject, message: body.message });
  return Response.json({ id: inquiry.id }, { status: 201 });
}

export const POST = withApiObservability("/api/inquiries/intake", handlePOST);
