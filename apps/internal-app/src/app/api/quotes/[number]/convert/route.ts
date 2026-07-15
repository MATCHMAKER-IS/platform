/** 見積: 請求書へ変換(POST)。quote:write と invoice:write が必要。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { quoteStore, invoiceStore, auditActions } from "../../../../../server/platform-services.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "quote:write");
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as { number: string; issueDate: string; dueDate: string; registrationNumber?: string };
  if (!body.number || !body.issueDate || !body.dueDate) return Response.json({ error: "請求書番号・発行日・支払期限は必須です" }, { status: 400 });
  if (await invoiceStore.get(body.number)) return Response.json({ error: "同じ番号の請求書が既にあります" }, { status: 409 });
  const invoice = await quoteStore.toInvoice(number, body);
  if (!invoice) return Response.json({ error: "見積が見つかりません" }, { status: 404 });
  const header = { number: invoice.number, issueDate: invoice.issueDate, dueDate: invoice.dueDate, billTo: invoice.billTo, ...(invoice.registrationNumber ? { registrationNumber: invoice.registrationNumber } : {}) };
  const rec = await invoiceStore.create(header, invoice.lines);
  await auditActions.record(user!.email, "quote.convert", `quote:${number}`, { after: { invoice: rec.number } });
  return Response.json(rec, { status: 201 });
}

export const POST = withApiObservability("/api/quotes/[number]/convert", handlePOST);
