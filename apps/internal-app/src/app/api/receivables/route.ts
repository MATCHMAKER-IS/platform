/** 売掛: エイジングと督促のサマリー(GET)。invoice:read が必要。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { invoiceStore } from "../../../server/platform-services.js";
import { receivablesSummary, type ReceivableInvoice } from "../../../server/receivables.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:read");
  const invoices = await invoiceStore.list();
  const input: ReceivableInvoice[] = invoices.map((i) => ({ number: i.number, billTo: i.billTo, dueDate: i.dueDate, total: i.totals.total, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  return Response.json(receivablesSummary(input));
}

export const GET = withApiObservability("/api/receivables", handleGET);
