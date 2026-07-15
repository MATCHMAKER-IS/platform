/** 会計: 勘定科目マスタ 一覧(GET)・登録更新/削除(POST)。accounting:read（財務）。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { accountMasterStore, auditActions } from "../../../../server/platform-services.js";
import { normalizeType } from "../../../../server/account-master-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  return Response.json({ accounts: await accountMasterStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const body = (await req.json()) as { account: string; type?: string; remove?: boolean };
  if (!body.account) return Response.json({ error: "account が必要です" }, { status: 400 });
  if (body.remove) { await accountMasterStore.remove(body.account); await auditActions.record(user!.email, "account.remove", `account:${body.account}`, {}); return Response.json({ removed: body.account }); }
  const type = normalizeType(body.type ?? "");
  if (!type) return Response.json({ error: "type は asset/liability/equity/revenue/expense" }, { status: 400 });
  await accountMasterStore.upsert({ account: body.account, type });
  await auditActions.record(user!.email, "account.upsert", `account:${body.account}`, { after: { type } });
  return Response.json({ account: body.account, type });
}

export const GET = withApiObservability("/api/accounting/accounts", handleGET);
export const POST = withApiObservability("/api/accounting/accounts", handlePOST);
