/** 商品マスタ: CSV取り込み(POST)。SKU・名称・単位を一括登録。dryRun でプレビュー。inventory:write。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { inventoryStore, auditActions } from "../../../../server/platform-services.js";
import { parseProductCsv } from "../../../../server/csv-import.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "inventory:write");
  const body = (await req.json()) as { csv?: string; dryRun?: boolean };
  if (!body.csv || body.csv.trim().length === 0) return Response.json({ error: "CSV 本文が空です" }, { status: 400 });
  const { rows, errors } = parseProductCsv(body.csv);
  if (body.dryRun) return Response.json({ preview: true, valid: rows.length, errors });
  let imported = 0;
  let skipped = 0;
  for (const product of rows) {
    if (await inventoryStore.getProduct(product.sku)) { skipped += 1; continue; }
    await inventoryStore.createProduct(product);
    imported += 1;
  }
  await auditActions.record(user!.email, "product.import", `count:${imported}`, { after: { imported, skipped, errors: errors.length } });
  return Response.json({ imported, skipped, errors });
}

export const POST = withApiObservability("/api/inventory/import", handlePOST);
