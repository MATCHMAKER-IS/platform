/** 発注: 一覧(GET)・発注点割れからの起票保存(POST)。閲覧は purchase:read、作成は purchase:write。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { purchaseStore, inventoryStore, auditActions, partnerStore } from "../../../server/platform-services.js";
import { buildReorderPurchaseOrder, reorderSkus } from "../../../server/purchase-draft.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "purchase:read");
  return Response.json({ orders: await purchaseStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "purchase:write");
  const body = (await req.json().catch(() => ({}))) as { supplier?: string; dueDate?: string; partnerCode?: string };
  let supplier = body.supplier;
  if (body.partnerCode) {
    const partner = await partnerStore.get(body.partnerCode);
    if (!partner) return Response.json({ error: "指定された取引先が見つかりません" }, { status: 400 });
    supplier = partner.name;
  }
  const statuses = await inventoryStore.status();
  const now = new Date();
  const number = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const order = buildReorderPurchaseOrder(statuses, { number, orderDate: now.toISOString().slice(0, 10), supplier: supplier ?? "(仕入先未設定)", ...(body.dueDate ? { dueDate: body.dueDate } : {}) });
  if (!order) return Response.json({ error: "発注が必要な商品はありません" }, { status: 200 });
  const rec = await purchaseStore.create({ ...order, state: "ordered" }, reorderSkus(statuses));
  await auditActions.record(user!.email, "purchase.create", `po:${rec.number}`, { after: { lines: rec.order.lines.length } });
  return Response.json({ order: rec }, { status: 201 });
}

export const GET = withApiObservability("/api/purchase-orders", handleGET);
export const POST = withApiObservability("/api/purchase-orders", handlePOST);
