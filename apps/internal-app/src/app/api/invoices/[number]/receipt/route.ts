/** 請求: 日付つき入金の記録(POST)。入金記録に残しつつ請求の入金済み額も更新する。invoice:write。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { invoiceStore, receiptStore, periodLockStore, auditActions } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as { amount: number; receivedAt?: string };
  if (typeof body.amount !== "number" || body.amount <= 0) return Response.json({ error: "正の入金額を入力してください" }, { status: 400 });
  const view = await invoiceStore.get(number);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  const receivedAt = body.receivedAt && /^\d{4}-\d{2}-\d{2}/.test(body.receivedAt) ? body.receivedAt : new Date().toISOString().slice(0, 10);
  if ((await periodLockStore.lockedSet()).has(receivedAt.slice(0, 7))) return Response.json({ error: `${receivedAt.slice(0, 7)} は締め済みのため入金記録できません` }, { status: 409 });
  const receipt = await receiptStore.record(number, body.amount, receivedAt);
  await invoiceStore.recordPayment(number, body.amount);
  await auditActions.record(user!.email, "invoice.receipt", `invoice:${number}`, { after: { amount: body.amount, receivedAt } });
  return Response.json(receipt, { status: 201 });
}

export const POST = withApiObservability("/api/invoices/[number]/receipt", handlePOST);
