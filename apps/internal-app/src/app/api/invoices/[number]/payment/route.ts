/** 請求書: 入金記録(POST)。invoice:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument";
// **二重送信を防ぐ。** 入金は連打・再送で二重に記録されると、
// **残高が合わなくなる**——取り消しても監査ログには 2 回分が残る。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { invoiceStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "invoice:write");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任で、
  // こちらで捏造すると「毎回違うキー」になり重複を防げない。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, ctx, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, ctx: { params: Promise<{ number: string }> }, actor: string): Promise<Response> {
  const { number } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { amount: number };
  // **円は整数で受ける。** 小数を通すと DB に `1000.0000000001` のような値が入り、
  // 合計が 1 円合わない原因になる(金額カラムを Int に変えたのはこのため)。
  // `Number.isSafeInteger` は NaN / Infinity / 小数をまとめて弾く。
  if (!Number.isSafeInteger(body.amount) || body.amount <= 0) {
    return Response.json({ error: "入金額は 1 円以上の整数で指定してください" }, { status: 400 });
  }
  const view = await invoiceStore.recordPayment(number, body.amount);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  await auditActions.record(actor, "invoice.payment", `invoice:${number}`, { after: { amount: body.amount, status: view.status } });
  return Response.json(view);
}

export const POST = withApiObservability("/api/invoices/[number]/payment", handlePOST);
