/** 発注: 一覧(GET)・発注点割れからの起票保存(POST)。閲覧は purchase:read、作成は purchase:write。 */
import { withApiObservability } from "../../../server/instrument";
// **二重送信を防ぐ。** 発注は連打・再送で二重に起票されると、
// 相手に 2 通の発注書が届く。**送ってから取り消すのは相手の手間**になる。
//
// **元のコードは正しかった。** `import` が 1 行欠けていただけで、
// 実行すると `ReferenceError` になっていた(2026-08 に発見)。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../server/idempotency";
import { formatDateJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { purchaseStore, inventoryStore, auditActions, partnerStore } from "../../../server/platform-services";
import { buildReorderPurchaseOrder, reorderSkus } from "../../../server/purchase-draft";
import { validate, z } from "@platform/validation";

/**
 * 発注の入力。
 *
 * **`dueDate` は納期として相手に伝わる**ので、形が崩れると
 * 「2026-13-45」のような日付が発注書に載る。**送ってから直せない**。
 */
const OrderInput = z.object({
  supplier: z.string().max(100).optional(),
  // 日付の形だけを見る（実在するかは Date で確かめる）
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "納期は YYYY-MM-DD で指定してください").optional(),
  partnerCode: z.string().max(50).optional(),
});

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "purchase:read");
  return Response.json({ orders: await purchaseStore.list() });
}

/**
 * 発注を作る。
 *
 * **冪等キーがあれば 1 回だけ実行する。**
 * 通信が切れてクライアントが送り直したとき、
 * 発注が 2 件できると仕入先へ二重に注文が飛ぶ。
 *
 * 発注番号は分単位(`PO-20260808-1430`)なので、
 * **同じ分に 2 回押すと同じ番号の別レコード**になる。
 * 番号を細かくするより、そもそも 2 回実行しない方が確実。
 */
async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "purchase:write");
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => createOrder(req, user!.email));
}

/** 発注の本体(冪等キーの内側で 1 回だけ動く)。 */
async function createOrder(req: Request, actor: string): Promise<Response> {
  const parsed = validate(OrderInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  let supplier = body.supplier;
  if (body.partnerCode) {
    const partner = await partnerStore.get(body.partnerCode);
    if (!partner) return Response.json({ error: "指定された取引先が見つかりません" }, { status: 400 });
    supplier = partner.name;
  }
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
  const order = buildReorderPurchaseOrder(statuses, { number, orderDate: new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10), supplier: supplier ?? "(仕入先未設定)", ...(body.dueDate ? { dueDate: body.dueDate } : {}) });
  if (!order) return Response.json({ error: "発注が必要な商品はありません" }, { status: 200 });
  const rec = await purchaseStore.create({ ...order, state: "ordered" }, reorderSkus(statuses));
  await auditActions.record(actor, "purchase.create", `po:${rec.number}`, { after: { lines: rec.order.lines.length } });
  return Response.json({ order: rec }, { status: 201 });
}

export const GET = withApiObservability("/api/purchase-orders", handleGET);
export const POST = withApiObservability("/api/purchase-orders", handlePOST);
