/** 在庫: 入出庫の記録(POST)。inventory:write が必要。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { inventoryStore, auditActions } from "../../../../server/platform-services";
import { type StockMovement } from "@platform/inventory";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:write");
  const body = (await req.json()) as { sku: string } & StockMovement;
  if (!body.sku || !(await inventoryStore.getProduct(body.sku))) return Response.json({ error: "商品が見つかりません" }, { status: 404 });
  if (body.type !== "inbound" && body.type !== "outbound" && body.type !== "adjustment") return Response.json({ error: "type が不正です" }, { status: 400 });
  if (typeof body.quantity !== "number" || Number.isNaN(body.quantity)) return Response.json({ error: "quantity が不正です" }, { status: 400 });
  const movement: StockMovement = { type: body.type, quantity: body.quantity, at: body.at ?? new Date().toISOString() };
  if (body.ref) movement.ref = body.ref;
  if (body.unitCost !== undefined) movement.unitCost = body.unitCost;
  await inventoryStore.recordMovement(body.sku, movement);
  await auditActions.record(user!.email, "inventory.movement.record", `product:${body.sku}`, { after: { type: movement.type, quantity: movement.quantity } });
  return Response.json({ ok: true }, { status: 201 });
}

export const POST = withApiObservability("/api/inventory/movements", handlePOST);
