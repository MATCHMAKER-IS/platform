// public-api: 見本用。パスワード再設定の発行と検証をサーバで行う
/**
 * パスワード再設定の見本用 API。
 *
 * 【なぜ画面から直接呼ばないか】
 * トークンのハッシュ化に **`node:crypto`** を使います。ブラウザには無いので、
 * `"use client"` の画面から `@platform/auth` を取ると
 * **`next build` が落ちます**（`UnhandledSchemeError`。2026-08）。
 *
 * それ以前に——**再設定トークンを画面で作ってはいけません**。
 * 発行も検証もサーバでなければ、**誰でも他人の再設定を通せます**。
 *
 * **この API は見本です。** 実運用では:
 *   - ストアは **DB**（ここはプロセスのメモリ。再起動で消えます）
 *   - トークンは**メールで送る**（ここは画面に返しています）
 *   - **発行の回数を絞る**（総当たりと嫌がらせの両方を防ぐ）
 */
import {
  issuePasswordReset, verifyPasswordReset, completePasswordReset,
  createMemoryPasswordResetStore, hashResetToken,
} from "@platform/auth";
import { passwordStrength } from "@platform/crypto";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";
import { validate, z } from "@platform/validation";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

/**
 * 呼び出しの上限。
 *
 * **総当たりを止めるためです。** 再設定の申請を無制限に許すと、**嫌がらせのメール送信**にも使われます。
 * 見本であっても、**制限の無い口を置いた見本**は真似されます。
 *
 * ここはメモリなので**サーバが 2 台になると効きません**——
 * 実運用では `@platform/ratelimit` の共有ストアを使ってください。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 5,
  windowSeconds: 60,
  // **制限器が落ちたら通さない（fail-close）。**
  // 既定は「落ちたら通す」——守りのために業務が止まる方が困るため。
  // **しかし秘密を当てにいける口では逆**で、
  // **制限器を落とすだけで防御を外せる**ことになります。
  onStoreError: "deny",
});


/**
 * 見本用のストア。
 *
 * **モジュールの寿命だけ**持ちます。実運用では DB に置いてください
 * ——ここに置くと、**サーバが 2 台になった時点で動かなくなります**。
 */
const store = createMemoryPasswordResetStore();

/**
 * 受け取る指示。
 *
 * **見本でも入力は検証します。** 長さの上限が無いと、
 * **巨大な文字列を送られてサーバが止まります**（`check-input-validation`）。
 */
const Input = z.object({
  action: z.enum(["issue", "verify", "complete"]),
  driftMs: z.number().int().min(-86_400_000).max(86_400_000).default(0),
  userId: z.string().max(200).default(""),
  token: z.string().max(500).default(""),
  password: z.string().max(200).default(""),
});

async function handlePOST(req: Request): Promise<Response> {
  // **数える前に落とす。** 検証の前に上限を見ないと、
  // 総当たりの負荷そのものは受け切ることになります
  const rl = await limiter.check(`password-reset:${clientIp(req)}`);
  // **制限器が落ちたときは通さない（fail-close）。**
  // `rl.ok` が false のときに素通りさせると、
  // **制限器を落とすだけで総当たりが通ります**——秘密を当てさせる口では、
  // 「一時的に使えない」より「一時的に通る」方がはるかに悪い
  if (!rl.ok || !rl.value.allowed) {
    return Response.json(
      { error: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = validate(Input, await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.value;
  // **見本のため、時計をずらせるようにしてあります**（期限切れを試すため）。
  // 実運用でこの口を開けてはいけません——**期限を無効にできてしまいます**
  const now = () => Date.now() + body.driftMs;

  if (body.action === "issue") {
    const issued = await issuePasswordReset(store, body.userId, { expiresInMinutes: 30, now });
    return Response.json({
      // **見本なのでトークンを返しています。** 実運用ではメールで送ります
      token: issued.token,
      // 保存されているのはハッシュだけ、と見せるため
      hashHead: hashResetToken(issued.token).slice(0, 16),
    });
  }

  if (body.action === "verify") {
    const v = await verifyPasswordReset(store, body.token.trim(), now);
    // **理由は返しません。** 「期限切れ」と「存在しない」を区別して返すと、
    // **トークンの当たりを探す手がかり**になります
    return Response.json({ ok: v.ok });
  }

  if (body.action === "complete") {
    const v = await verifyPasswordReset(store, body.token.trim(), now);
    if (!v.ok) return Response.json({ ok: false, reason: "token" });
    // **弱いパスワードはここで止める。** 画面側の判定は書き換えられます
    const s = passwordStrength(body.password);
    if (s.score < 2) {
      return Response.json({ ok: false, reason: "weak", score: s.score, label: s.label, suggestions: s.suggestions });
    }
    await completePasswordReset(store, v.tokenHash, now);
    return Response.json({ ok: true, score: s.score, label: s.label });
  }

  return Response.json({ error: "action が不正です" }, { status: 400 });
}

export const POST = handleRoute(handlePOST);
