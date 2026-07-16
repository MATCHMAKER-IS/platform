/** 在庫: 商品詳細(GET)。台帳・倉庫別在庫・期限管理を返す。inventory:read が必要。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { inventoryStore } from "../../../../server/platform-services";

async function handleGET(req: Request, ctx: { params: Promise<{ sku: string }> }): Promise<Response> {
  const { sku } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:read");
  const days = Number(new URL(req.url).searchParams.get("expiryDays") ?? "30");
  const detail = await inventoryStore.detail(sku, new Date().toISOString(), Number.isNaN(days) ? 30 : days);
  if (!detail) return Response.json({ error: "商品が見つかりません" }, { status: 404 });
  return Response.json(detail);
}

export const GET = withApiObservability("/api/inventory/[sku]", handleGET);
