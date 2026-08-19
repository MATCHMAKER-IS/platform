/** 買掛金: 発注への支払記録(POST)。purchase:write。 */
import { withApiObservability } from "../../../../../server/instrument";
// **二重送信を防ぐ。** 支払は連打・再送で二重に記録されると、
// **残高が合わなくなる**——取り消しても監査ログには 2 回分が残る。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { purchaseStore, purchasePaymentStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "purchase:write");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任で、
  // こちらで捏造すると「毎回違うキー」になり重複を防げない。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, ctx, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, ctx: { params: Promise<{ number: string }> }, actor: string): Promise<Response> {
  const { number } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { amount: number };
  // **円は整数で受ける。** 小数を通すと Int 列への書き込みで落ちる。
  if (!Number.isSafeInteger(body.amount) || body.amount <= 0) {
    return Response.json({ error: "支払額は 1 円以上の整数で指定してください" }, { status: 400 });
  }
  if (!(await purchaseStore.get(number))) return Response.json({ error: "発注が見つかりません" }, { status: 404 });
  const payment = await purchasePaymentStore.record(number, body.amount);
  await auditActions.record(actor, "payable.payment", `po:${number}`, { after: { amount: body.amount } });
  return Response.json(payment, { status: 201 });
}

export const POST = withApiObservability("/api/payables/[number]/payment", handlePOST);
