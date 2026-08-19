// public-api: 見本用。証拠の連鎖とタイムスタンプをサーバで扱う
/**
 * 電子帳簿保存法まわりの見本用 API。
 *
 * 【なぜ画面でやらないか】
 * ハッシュ連鎖もタイムスタンプも **`node:crypto`** を使うので、
 * ブラウザでは動きません（`next build` が `UnhandledSchemeError` で落ちます）。
 *
 * それ以前に——**改ざん検知を画面でやっては意味がありません**。
 * 「改ざんされていません」と画面が言うだけなら、**その画面ごと書き換えられます**。
 * 検証はサーバで行い、画面は**結果を見せるだけ**にします。
 *
 * 検索（`searchTransactions`）と保存期限（`retentionDeadline`）は
 * **計算だけ**なので画面に残しています（`@platform/dencho/search` /
 * `@platform/dencho/retention`）。
 */
import {
  appendEvidence, verifyEvidenceChain, sha256Hex,
  createTimestampToken, verifyTimestampToken,
  type EvidenceRecord,
} from "@platform/dencho";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";
import { validate, z } from "@platform/validation";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";

/**
 * 呼び出しの上限。
 *
 * **タイムスタンプの秘密を当てにいける口です。** 回数を絞ります。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 30,
  windowSeconds: 60,
  // **制限器が落ちたら通さない（fail-close）。**
  onStoreError: "deny",
});

/**
 * 取引 1 件。
 *
 * **見本なので緩く受けています。** 実運用では
 * 勘定科目や税区分まで含めて検証してください。
 */
const Tx = z.object({
  transactionDate: z.string().max(20),
  counterparty: z.string().max(200),
  amount: z.number().int(),
  documentType: z.string().max(50).optional(),
  documentId: z.string().max(100).optional(),
});

const Input = z.object({
  action: z.enum(["build", "verify", "stamp"]),
  /** `build` / `stamp` で使う取引。 */
  transactions: z.array(Tx).max(200).default([]),
  /** `verify` で使う、画面が持っている連鎖。 */
  chain: z.array(z.object({
    seq: z.number().int(),
    hash: z.string().max(200),
    prevHash: z.string().max(200),
    recordedAt: z.string().max(40),
    data: z.unknown(),
  })).max(200).default([]),
  secret: z.string().max(200).default(""),
});

async function handlePOST(req: Request): Promise<Response> {
  const rl = await limiter.check(`dencho-demo:${clientIp(req)}`);
  if (!rl.ok || !rl.value.allowed) {
    return Response.json(
      { error: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const parsed = validate(Input, await req.json().catch(() => ({})));
  if (!parsed.ok) return Response.json({ error: "本文の形が正しくありません" }, { status: 400 });
  const body = parsed.value;

  if (body.action === "build") {
    // **記録した順に繋ぐ。** 1 件でも順序が変わると以降すべての hash が変わります
    const chain: EvidenceRecord[] = [];
    for (const t of body.transactions) {
      chain.push(appendEvidence(chain, t, `${t.transactionDate}T09:00:00Z`));
    }
    return Response.json({ chain });
  }

  if (body.action === "verify") {
    return Response.json({ verification: verifyEvidenceChain(body.chain as EvidenceRecord[]) });
  }

  if (body.action === "stamp") {
    const first = body.transactions[0];
    if (first === undefined) return Response.json({ error: "取引がありません" }, { status: 400 });
    const digest = sha256Hex(JSON.stringify(first));
    // 見本なので時刻を固定（毎回同じ結果を見せるため）
    const token = createTimestampToken(digest, body.secret, new Date("2026-07-17T00:00:00Z"));
    return Response.json({ token, ok: verifyTimestampToken(token, body.secret, digest) });
  }

  return Response.json({ error: "action が不正です" }, { status: 400 });
}

export const POST = handleRoute(handlePOST);
