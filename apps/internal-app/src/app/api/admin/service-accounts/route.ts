/** 管理: サービスアカウント(APIキー)の一覧(GET)・発行/失効(POST)。管理者のみ。平文キーは発行時のみ返す。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { serviceAccountStore, auditActions } from "../../../../server/platform-services";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ accounts: await serviceAccountStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { op?: string; name?: string; scopes?: string[]; id?: string; active?: boolean };
  if (body.op === "create") {
    if (!body.name || !Array.isArray(body.scopes) || body.scopes.length === 0) return Response.json({ error: "name と scopes が必要です" }, { status: 400 });
    const { account, plaintext } = await serviceAccountStore.create(body.name, body.scopes);
    await auditActions.record(user.email, "serviceAccount.create", `sa:${account.id}`, { after: { scopes: body.scopes } });
    // plaintext はこの応答でのみ返す（保存されない）
    return Response.json({ account, plaintext }, { status: 201 });
  }
  if (body.op === "setActive" && body.id && typeof body.active === "boolean") {
    await serviceAccountStore.setActive(body.id, body.active);
    await auditActions.record(user.email, body.active ? "serviceAccount.enable" : "serviceAccount.revoke", `sa:${body.id}`, {});
    return Response.json({ id: body.id, active: body.active });
  }
  return Response.json({ error: "不正な操作です" }, { status: 400 });
}

export const GET = withApiObservability("/api/admin/service-accounts", handleGET);
export const POST = withApiObservability("/api/admin/service-accounts", handlePOST);
