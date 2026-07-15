/** 買掛金: 発注への支払記録(POST)。purchase:write。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { purchaseStore, purchasePaymentStore, auditActions } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "purchase:write");
  const body = (await req.json()) as { amount: number };
  if (typeof body.amount !== "number" || body.amount <= 0) return Response.json({ error: "正の金額を入力してください" }, { status: 400 });
  if (!(await purchaseStore.get(number))) return Response.json({ error: "発注が見つかりません" }, { status: 404 });
  const payment = await purchasePaymentStore.record(number, body.amount);
  await auditActions.record(user!.email, "payable.payment", `po:${number}`, { after: { amount: body.amount } });
  return Response.json(payment, { status: 201 });
}

export const POST = withApiObservability("/api/payables/[number]/payment", handlePOST);
