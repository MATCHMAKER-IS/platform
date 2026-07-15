/** 会計: 月次締めロック 一覧(GET)・ロック/解除(POST)。閲覧は accounting:read、変更は period:lock。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { periodLockStore, auditActions } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  return Response.json({ locks: await periodLockStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "period:lock");
  const body = (await req.json()) as { period: string; action: "lock" | "unlock" };
  if (!/^\d{4}-\d{2}$/.test(body.period ?? "") || !["lock", "unlock"].includes(body.action)) return Response.json({ error: "period(YYYY-MM)・action(lock/unlock)が必要です" }, { status: 400 });
  if (body.action === "lock") await periodLockStore.lock(body.period, user!.email);
  else await periodLockStore.unlock(body.period);
  await auditActions.record(user!.email, `period.${body.action}`, `period:${body.period}`, {});
  return Response.json({ period: body.period, locked: body.action === "lock" });
}

export const GET = withApiObservability("/api/accounting/locks", handleGET);
export const POST = withApiObservability("/api/accounting/locks", handlePOST);
