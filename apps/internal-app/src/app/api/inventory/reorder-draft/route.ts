/** 在庫: 発注点割れから発注書ドラフトを起票(POST)。inventory:write が必要。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { inventoryStore, auditActions } from "../../../../server/platform-services.js";
import { buildReorderPurchaseOrder } from "../../../../server/purchase-draft.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:write");
  const body = (await req.json().catch(() => ({}))) as { supplier?: string; dueDate?: string };
  const statuses = await inventoryStore.status();
  const now = new Date();
  const number = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const order = buildReorderPurchaseOrder(statuses, { number, orderDate: now.toISOString().slice(0, 10), supplier: body.supplier ?? "(仕入先未設定)", ...(body.dueDate ? { dueDate: body.dueDate } : {}) });
  if (!order) return Response.json({ error: "発注が必要な商品はありません" }, { status: 200 });
  await auditActions.record(user!.email, "inventory.reorder.draft", `po:${order.number}`, { after: { lines: order.lines.length } });
  return Response.json({ order });
}

export const POST = withApiObservability("/api/inventory/reorder-draft", handlePOST);
