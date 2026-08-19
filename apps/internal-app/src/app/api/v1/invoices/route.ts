/**
 * 外部向けAPI(v1): 請求一覧。Authorization: Bearer <APIキー> で認証し、scope "invoice:read" を要求。
 * セッションではなくサービスアカウントで認証する例。
 */
import { withApiObservability } from "../../../../server/instrument";
import { makeETag, notModified } from "@platform/http";
import { serviceAccountStore, invoiceStore } from "../../../../server/platform-services";
import { authenticateKey, bearerToken } from "../../../../server/service-account-repo";
import { getApiKeyLimiter } from "../../../../server/rate-limit";

async function handleGET(req: Request): Promise<Response> {
  const token = bearerToken(req.headers.get("authorization"));
  const auth = authenticateKey(await serviceAccountStore.all(), token, "invoice:read");
  if (!auth.ok) {
    const status = auth.reason === "forbidden" ? 403 : 401;
    return Response.json({ error: `APIキー認証に失敗しました (${auth.reason})` }, { status });
  }
  // **最終使用日時を記録する。** await しない(fire-and-forget)——
  // 記録の失敗でリクエスト自体を失敗させる理由が無い。
  void serviceAccountStore.markUsed(auth.account!.id);

  // APIキー単位のレート制限
  const rl = await getApiKeyLimiter().check(`api:${auth.account!.id}`);
  if (rl.ok && !rl.value.allowed) {
    return Response.json({ error: "レート制限を超過しました。しばらくしてから再試行してください" }, { status: 429, headers: { "retry-after": "60", "x-ratelimit-limit": String(rl.value.limit), "x-ratelimit-remaining": String(rl.value.remaining) } });
  }
  const invoices = await invoiceStore.list();
  const body = { account: auth.account!.name, invoices };

  // **変わっていなければ本文を送らない。**
  // 外部の連携先は定期的に取りに来るので、
  // 件数が増えるほど全件送信の無駄が効いてくる。
  //
  // ETag は**中身から作る**ので、1 件でも変われば値が変わる
  const etag = makeETag(body);
  if (notModified(req, etag)) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return Response.json(body, { headers: { etag } });
}

export const GET = withApiObservability("/api/v1/invoices", handleGET);
