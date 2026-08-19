/** 請求: 日付つき入金の記録(POST)。入金記録に残しつつ請求の入金済み額も更新する。invoice:write。 */
import { withApiObservability } from "../../../../../server/instrument";
// **二重送信を防ぐ。** 入金は連打・再送で二重に記録されると、
// **残高が合わなくなる**——取り消しても監査ログには 2 回分が残る。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../../server/idempotency";
import { formatDateJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { invoiceStore, receiptStore, periodLockStore, auditActions } from "../../../../../server/platform-services";

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
  const body = (await req.json().catch(() => ({}))) as { amount: number; receivedAt?: string };
  // **円は整数で受ける。** 小数を通すと DB に端数が入り、合計が 1 円合わなくなる。
  if (!Number.isSafeInteger(body.amount) || body.amount <= 0) {
    return Response.json({ error: "入金額は 1 円以上の整数で指定してください" }, { status: 400 });
  }
  const view = await invoiceStore.get(number);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  // 入金日。**この直後に締め月を判定する**ので、UTC で切ると月初深夜の入金が前月扱いになる
  const receivedAt = body.receivedAt && /^\d{4}-\d{2}-\d{2}/.test(body.receivedAt) ? body.receivedAt : formatDateJst();
  if ((await periodLockStore.lockedSet()).has(receivedAt.slice(0, 7))) return Response.json({ error: `${receivedAt.slice(0, 7)} は締め済みのため入金記録できません` }, { status: 409 });
  const receipt = await receiptStore.record(number, body.amount, receivedAt);
  await invoiceStore.recordPayment(number, body.amount);
  await auditActions.record(actor, "invoice.receipt", `invoice:${number}`, { after: { amount: body.amount, receivedAt } });
  return Response.json(receipt, { status: 201 });
}

export const POST = withApiObservability("/api/invoices/[number]/receipt", handlePOST);
