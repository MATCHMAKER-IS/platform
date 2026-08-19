// public-api: 社外向けの問い合わせ受付(公開フォーム)。レート制限で保護する
/** 公開サイト: お問い合わせ受付(POST)。社内アプリのインテークAPIへ転送して受信一覧に集約する。 */
// **束ねた入口（`@platform/form`）から取らない。**
// そちらは `react-hook-form`（クライアント専用）を巻き込み、
// サーバのルートに載せると next build が
// `'useForm' is not exported from 'react-hook-form'` を出す
import { isHoneypotFilled } from "@platform/form/honeypot";
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit/browser";
import { siteEnv } from "../../../server/env";

/**
 * 受け取る本文の上限(バイト)。
 *
 * **100KB。** 問い合わせの文面としては十分すぎる。
 * ここは**社外に開いた口**なので、社内向けより厳しくする。
 */
const MAX_BODY_BYTES = 100_000;

let limiter: RateLimiter | undefined;

/**
 * 回数制限。
 *
 * **1 分に 5 回。** 社外に開いているので厳しめ。
 * 人が問い合わせを送る限り届かず、いたずらや自動送信は止まる。
 * 冒頭のコメントは「レート制限で保護する」と書いていたが、
 * **実装が無かった**(2026-08 に気づいた)。
 *
 * **ストアがメモリなので、複数インスタンスでは効きが薄い。**
 * カウンタはプロセスごとに持つので、2 台構成なら**上限が実質 2 倍**、
 * サーバレス(インスタンスが都度作られる構成)なら**ほぼ無制限に送れる**。
 *
 * 問い合わせフォームは**公開**でスパムの標的になりやすいので、
 * **本番では Redis のストアに差し替えること**
 * (`@platform/ratelimit` の `createRedisStore`)。
 * 1 台構成のうちは、これで止まる分だけ意味がある(2026-08 に明記)。
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
  const hit = await getLimiter().check(`contact:${ip}`);
  // ストアが落ちたら通す(問い合わせを受けられない方が困る)
  if (hit.ok && !hit.value.allowed) {
    return Response.json(
      { error: "送信が続いています。しばらくしてからお試しください。" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; category?: string; subject?: string; message?: string };

  // **ハニーポットが埋まっていたら機械。** 人には見えない欄なので、
  // 埋まっているのは自動入力しかない。**弾いたことを伝えず成功に見せる**
  // ——「弾かれた」と分かると、次は埋めずに送ってくる。
  //
  // レート制限だけでは**分散したスパムが止まらない**(1 通ずつ来る)。
  // 基盤に `isHoneypotFilled` があるのに 2026-08 まで繋いでいなかった。
  if (isHoneypotFilled((body as { website?: unknown }).website)) {
    return Response.json({ ok: true });
  }

  if (!body.name || !body.email || !body.subject || !body.message) return Response.json({ error: "必須項目を入力してください。" }, { status: 400 });
  // no-ssrf-check: 送信先は環境変数 INTERNAL_INQUIRY_URL(管理者が設定する固定値)。利用者は指定できない
  const intakeUrl = siteEnv.INTERNAL_INQUIRY_URL;
  const token = siteEnv.INQUIRY_INTAKE_TOKEN;
  if (!intakeUrl || !token) return Response.json({ error: "受付設定が未構成です。" }, { status: 503 });
  try {
    const res = await fetch(intakeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Intake-Token": token },
      body: JSON.stringify(body),
      // **時間を切る。** 社内側が応答しないと、
      // 問い合わせフォームが延々と待たされる
      signal: AbortSignal.timeout(10_000),
      // **リダイレクトを追わない。** 転送先が差し替えられたとき、
      // 問い合わせの内容(氏名・メール)が別の場所へ送られる
      redirect: "manual",
    });
    if (!res.ok) return Response.json({ error: "受付に失敗しました。" }, { status: 502 });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "受付に失敗しました。" }, { status: 502 });
  }
}

export const POST = handlePOST;
