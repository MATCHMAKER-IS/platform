/** 発注: 入荷記録(POST)。入荷分は在庫に入庫として反映する。purchase:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument";
// **二重送信を防ぐ。** 入荷記録は連打・再送で二重に走ると、
// **在庫が二重に増える**。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { purchaseStore, inventoryStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const user = currentUser(req);
  // **認可は冪等の外側で行う。** 2 回目の呼び出しは冪等キーで弾かれるため、
  // 中で認可すると 2 回目は権限チェックを経ずに結果が返ってしまう
  // (このセッションで繰り返し確認してきた設計原則。2026-08、ここでも欠けていた
  // ——`requirePermission(user, ...)` が `run` の中にあり、`user` はスコープ外だった)。
  requirePermission(user, "purchase:write");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, ctx, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, ctx: { params: Promise<{ number: string }> }, actor: string): Promise<Response> {
  const { number } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { lineIndex: number; quantity: number };
  if (typeof body.lineIndex !== "number" || typeof body.quantity !== "number" || body.quantity <= 0) return Response.json({ error: "行番号と数量が不正です" }, { status: 400 });
  const result = await purchaseStore.recordReceipt(number, { lineIndex: body.lineIndex, quantity: body.quantity, receivedAt: new Date().toISOString() });
  if (!result) return Response.json({ error: "発注が見つかりません" }, { status: 404 });
  if (result.inbound && (await inventoryStore.getProduct(result.inbound.sku))) {
    await inventoryStore.recordMovement(result.inbound.sku, { type: "inbound", quantity: result.inbound.quantity, at: new Date().toISOString(), ref: number });
  }
  await auditActions.record(actor, "purchase.receipt", `po:${number}`, { after: { lineIndex: body.lineIndex, quantity: body.quantity } });
  return Response.json(result.view);
}

export const POST = withApiObservability("/api/purchase-orders/[number]/receipts", handlePOST);
