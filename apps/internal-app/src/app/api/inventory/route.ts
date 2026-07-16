/** 在庫: 状況一覧(GET)・商品登録(POST)。閲覧は inventory:read、更新は inventory:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { inventoryStore, auditActions } from "../../../server/platform-services";
import { type Product } from "../../../server/inventory-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:read");
  return Response.json({ status: await inventoryStore.status() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:write");
  const body = (await req.json()) as Product;
  if (!body.sku || !body.name || !body.unit) return Response.json({ error: "sku・name・unit は必須です" }, { status: 400 });
  if (await inventoryStore.getProduct(body.sku)) return Response.json({ error: "同じ SKU の商品が既にあります" }, { status: 409 });
  const product = await inventoryStore.createProduct(body);
  await auditActions.record(user!.email, "inventory.product.create", `product:${product.sku}`, { after: { name: product.name } });
  return Response.json(product, { status: 201 });
}

export const GET = withApiObservability("/api/inventory", handleGET);
export const POST = withApiObservability("/api/inventory", handlePOST);
