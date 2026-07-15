/** 管理: 秘密情報の一覧(GET・名前のみ)・登録/ローテーション(POST)。管理者のみ。値は暗号化保存し、応答に平文は返さない。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { secretRecordStore, appSecretStore, auditActions } from "../../../../server/platform-services.js";
import { putSecret } from "../../../../server/secret-store.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ secrets: await secretRecordStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { name?: string; value?: string };
  if (!body.name || !body.value) return Response.json({ error: "name と value が必要です" }, { status: 400 });
  await putSecret(secretRecordStore, appSecretStore, serverEnv.SECRET_MASTER_KEY, body.name, body.value);
  await auditActions.record(user.email, "secret.set", `secret:${body.name}`, {});
  return Response.json({ name: body.name, saved: true }, { status: 201 });
}

export const GET = withApiObservability("/api/admin/secrets", handleGET);
export const POST = withApiObservability("/api/admin/secrets", handlePOST);
