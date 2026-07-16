/**
 * 外部向けAPI(v1): 請求一覧。Authorization: Bearer <APIキー> で認証し、scope "invoice:read" を要求。
 * セッションではなくサービスアカウントで認証する例。
 */
import { withApiObservability } from "../../../../server/instrument";
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
  // APIキー単位のレート制限
  const rl = await getApiKeyLimiter().check(`api:${auth.account!.id}`);
  if (rl.ok && !rl.value.allowed) {
    return Response.json({ error: "レート制限を超過しました。しばらくしてから再試行してください" }, { status: 429, headers: { "retry-after": "60", "x-ratelimit-limit": String(rl.value.limit), "x-ratelimit-remaining": String(rl.value.remaining) } });
  }
  const invoices = await invoiceStore.list();
  return Response.json({ account: auth.account!.name, invoices });
}

export const GET = withApiObservability("/api/v1/invoices", handleGET);
