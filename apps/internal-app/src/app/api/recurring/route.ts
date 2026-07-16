/** 繰り返し請求: 一覧(GET)・プラン作成(POST)。invoice:read / invoice:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { recurringStore, auditActions } from "../../../server/platform-services";
import { type RecurringPlanInput } from "../../../server/recurring-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:read");
  return Response.json({ plans: await recurringStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as RecurringPlanInput;
  if (!body.number || !body.billTo || !body.startDate) return Response.json({ error: "番号・宛先・開始日は必須です" }, { status: 400 });
  if (!["monthly", "quarterly", "yearly"].includes(body.interval)) return Response.json({ error: "周期が不正です" }, { status: 400 });
  if (!Array.isArray(body.lines) || body.lines.length === 0) return Response.json({ error: "明細を 1 行以上入力してください" }, { status: 400 });
  if (await recurringStore.get(body.number)) return Response.json({ error: "同じ番号のプランが既にあります" }, { status: 409 });
  const plan = await recurringStore.create(body);
  await auditActions.record(user!.email, "recurring.create", `plan:${plan.number}`, { after: { billTo: plan.billTo } });
  return Response.json(plan, { status: 201 });
}

export const GET = withApiObservability("/api/recurring", handleGET);
export const POST = withApiObservability("/api/recurring", handlePOST);
