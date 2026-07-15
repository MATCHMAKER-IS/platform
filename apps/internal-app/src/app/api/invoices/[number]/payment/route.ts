/** 請求書: 入金記録(POST)。invoice:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { invoiceStore, auditActions } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as { amount: number };
  if (typeof body.amount !== "number" || body.amount <= 0) return Response.json({ error: "入金額が不正です" }, { status: 400 });
  const view = await invoiceStore.recordPayment(number, body.amount);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "invoice.payment", `invoice:${number}`, { after: { amount: body.amount, status: view.status } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/invoices/[number]/payment", handlePOST);
