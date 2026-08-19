// public-api: 見本用。2 要素認証の登録と検証をサーバで行う
/**
 * 2 要素認証の見本用 API。
 *
 * 【なぜ画面から直接呼ばないか】
 * TOTP も予備コードも **HMAC（`node:crypto`）** を使います。
 * ブラウザには無い機能なので、`"use client"` の画面から
 * `@platform/auth` を取ると **`next build` が落ちます**
 * （`UnhandledSchemeError: Reading from "node:crypto"`。2026-08）。
 *
 * それ以前に——**検証をブラウザでやってはいけません**。
 * 画面の中で「合っている」と判定しても、**利用者が書き換えられます**。
 * 秘密も検証もサーバに置くのが、実運用でも正しい形です。
 *
 * **この API は見本です。** 実運用では:
 *   - 秘密は**利用者ごとに保存**する（ここでは受け取った値をそのまま使う）
 *   - **試行回数を絞る**（`@platform/session` の `createLoginThrottle`）
 *   - 予備コードの使用済みは**サーバで保存**する（ここでは画面が持ち回る）
 */
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";
import { validate, z } from "@platform/validation";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

/**
 * 呼び出しの上限。
 *
 * **総当たりを止めるためです。** コードは 6 桁しかないので、**回数を絞らないと総当たりで通ります**。
 * 見本であっても、**制限の無い口を置いた見本**は真似されます。
 *
 * ここはメモリなので**サーバが 2 台になると効きません**——
 * 実運用では `@platform/ratelimit` の共有ストアを使ってください。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 10,
  windowSeconds: 60,
  // **制限器が落ちたら通さない（fail-close）。**
  // 既定は「落ちたら通す」——守りのために業務が止まる方が困るため。
  // **しかし秘密を当てにいける口では逆**で、
  // **制限器を落とすだけで防御を外せる**ことになります。
  onStoreError: "deny",
});

import { validate } from "@platform/validation";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
import { z } from "zod";
import {
  generateTotpSecret, totp, verifyTotp, totpAuthUri,
  generateBackupCodes, verifyBackupCode, type BackupCodeRecord,
} from "@platform/auth";

/** 予備コードのハッシュに混ぜるアプリ固有の秘密（**見本用の固定値**）。 */
const BACKUP_SECRET = "demo-backup-secret-change-me";

/**
 * 受け取る指示。
 *
 * **見本なので状態を持ちません**——画面が持っている値を毎回送ります。
 */

/**
 * 受け取る本文の形。
 *
 * **型注釈（`Body`）とは別に、実行時に見るものが要ります。**
 */
/**
 * 本文の型は**スキーマから導きます**。
 * 別に手で書くと、**片方だけ直されて食い違います**。
 */
type Body = z.infer<typeof BodySchema>;

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }),
  z.object({ action: z.literal("code"), secret: z.string().min(1) }),
  z.object({
    action: z.literal("verify"),
    secret: z.string().min(1),
    input: z.string(),
    records: z.array(z.object({ hash: z.string(), usedAt: z.number().optional() })),
    driftSec: z.number().optional(),
  }),
]);

/**
 * 呼び出しの上限。
 *
 * **認証の無い API です。** 無制限に叩かせると、
 * 予備コードの照合を**総当たりに使えます**。
 * メモリ実装なのでサーバごとに数えます（複数台なら Redis 実装へ）。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 20,
  windowSeconds: 60,
});

async function handlePOST(req: Request): Promise<Response> {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`twofactor-demo:${clientIp(req)}`);
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

  const raw: unknown = await req.json().catch(() => null);
  // **`as Body` だけでは検証になりません。** 型は実行時に消えるので、
  // `{ action: "verify" }` だけ送られると `secret` が undefined のまま先へ進みます。
  // 形を実際に見てから使います（`check-input-validation` の指摘。2026-08）
  const parsed = validate(BodySchema, raw);
  if (!parsed.ok) {
    return Response.json({ error: "本文の形が正しくありません" }, { status: 400 });
  }
  const body: Body = parsed.value;

  if (body.action === "enroll") {
    const secret = generateTotpSecret();
    const backup = generateBackupCodes(BACKUP_SECRET, { count: 5 });
    return Response.json({
      secret,
      // 実運用ではこれを QR コードにして読ませる
      uri: totpAuthUri(secret, { issuer: "showcase", account: "demo@example.com" }),
      // **平文のコードを返すのはこの 1 回だけ。** 以後は記録（ハッシュ）しか持たない
      codes: backup.codes,
      records: backup.records,
    });
  }

  if (body.action === "code") {
    // 認証アプリが今表示しているはずの値（**見本のため**に見せている。
    // 実運用でサーバがこれを返すことはありません）
    return Response.json({ code: totp(body.secret) });
  }

  if (body.action === "verify") {
    // **記録は画面が持ち回ります**（見本なのでサーバに保存していません）。
    // 実運用では**サーバで保存**してください——画面が持つと、
    // 「使った予備コード」を**使っていないことにできます**
    const records: BackupCodeRecord[] = body.records;
    const input = body.input.trim();
    const at = new Date(Date.now() + body.driftSec * 1000);
    // まず TOTP として検証（時計のずれを ±1 枠まで許容）
    if (verifyTotp(body.secret, input, { window: 1 }, at)) {
      return Response.json({ ok: true, kind: "totp", records });
    }
    // 通らなければ予備コードとして検証（1 回使ったら無効）
    const r = verifyBackupCode(input, records, BACKUP_SECRET);
    if (r.valid) {
      return Response.json({
        ok: true,
        kind: "backup",
        records: r.records,
        left: r.records.filter((x) => x.usedAt === undefined).length,
      });
    }
    return Response.json({ ok: false, records });
  }

  return Response.json({ error: "action が不正です" }, { status: 400 });
}

export const POST = handleRoute(handlePOST);
