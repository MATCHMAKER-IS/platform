/** 在庫: 発注点割れから発注書ドラフトを起票(POST)。inventory:write が必要。 */
import { withApiObservability } from "../../../../server/instrument";
import { formatDateJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { inventoryStore, auditActions } from "../../../../server/platform-services";
import { buildReorderPurchaseOrder } from "../../../../server/purchase-draft";
import { validate, z } from "@platform/validation";

// **`dueDate` は納期として相手に伝わる。** 形が崩れると壊れた日付が
// 発注書に載る(purchase-orders/route.ts と同じ穴。2026-08 に発見)。
const ReorderInput = z.object({
  supplier: z.string().max(100).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "納期は YYYY-MM-DD で指定してください").optional(),
});

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "inventory:write");
  const parsed = validate(ReorderInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const statuses = await inventoryStore.status();
  // **JST の年月で作る。**
  // `new Date()` はサーバのタイムゾーン（コンテナは UTC）なので、
  // **JST の月初 0 時〜9 時は、UTC ではまだ前月**——
  // **朝早く発注すると、前月の番号**になります。
  // **番号は後から直せません**（すでに相手に送っているため）。
  const now = new Date();
  // **`todayJst()` は `Date` を返す。** 文字列が要るのは `formatDateJst()`
  // ——`.slice()` を呼んでいたため、**この行から先が実行時に落ちていた**。
  const today = formatDateJst();
  // **時刻も JST で。** `getHours()` はサーバのタイムゾーン（UTC）なので、
  // **9 時間ずれた番号**になります——**番号だけ見ても気づけません**。
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hh = String(jstNow.getUTCHours()).padStart(2, "0");
  const mm = String(jstNow.getUTCMinutes()).padStart(2, "0");
  const number = `PO-${today.slice(0, 4)}${today.slice(5, 7)}${today.slice(8, 10)}-${hh}${mm}`;
  const order = buildReorderPurchaseOrder(statuses, { number, orderDate: new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10), supplier: body.supplier ?? "(仕入先未設定)", ...(body.dueDate ? { dueDate: body.dueDate } : {}) });
  if (!order) return Response.json({ error: "発注が必要な商品はありません" }, { status: 200 });
  await auditActions.record(user!.email, "inventory.reorder.draft", `po:${order.number}`, { after: { lines: order.lines.length } });
  return Response.json({ order });
}

export const POST = withApiObservability("/api/inventory/reorder-draft", handlePOST);
