/** 繰り返し請求: 課金対象を一括で請求書化(POST)。invoice:write。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { recurringStore, invoiceStore, auditActions } from "../../../../server/platform-services";
import { invoiceFromPlan } from "../../../../server/recurring-repo";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const due = await recurringStore.due(now);
  const created: string[] = [];
  for (const plan of due) {
    const seq = today.replace(/-/g, "");
    const number = `${plan.number}-${seq}`;
    if (await invoiceStore.get(number)) continue; // 二重起票を防ぐ
    const dueDate = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
    const invoice = invoiceFromPlan(plan, { number, issueDate: today, dueDate });
    await invoiceStore.create({ number: invoice.number, issueDate: invoice.issueDate, dueDate: invoice.dueDate, billTo: invoice.billTo }, invoice.lines);
    await recurringStore.markBilled(plan.number, today);
    created.push(number);
  }
  await auditActions.record(user!.email, "recurring.run", `count:${created.length}`, { after: { created } });
  return Response.json({ created });
}

export const POST = withApiObservability("/api/recurring/run", handlePOST);
