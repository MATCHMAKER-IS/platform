/** 発注: 入荷記録(POST)。入荷分は在庫に入庫として反映する。purchase:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { purchaseStore, inventoryStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "purchase:write");
  const body = (await req.json()) as { lineIndex: number; quantity: number };
  if (typeof body.lineIndex !== "number" || typeof body.quantity !== "number" || body.quantity <= 0) return Response.json({ error: "行番号と数量が不正です" }, { status: 400 });
  const result = await purchaseStore.recordReceipt(number, { lineIndex: body.lineIndex, quantity: body.quantity, receivedAt: new Date().toISOString() });
  if (!result) return Response.json({ error: "発注が見つかりません" }, { status: 404 });
  if (result.inbound && (await inventoryStore.getProduct(result.inbound.sku))) {
    await inventoryStore.recordMovement(result.inbound.sku, { type: "inbound", quantity: result.inbound.quantity, at: new Date().toISOString(), ref: number });
  }
  await auditActions.record(user!.email, "purchase.receipt", `po:${number}`, { after: { lineIndex: body.lineIndex, quantity: body.quantity } });
  return Response.json(result.view);
}

export const POST = withApiObservability("/api/purchase-orders/[number]/receipts", handlePOST);
