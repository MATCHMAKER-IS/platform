/** 源泉徴収: 支払調書サマリーと明細(GET)・報酬支払の記録(POST)。withholding:read / withholding:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { feePaymentStore, auditActions } from "../../../server/platform-services";
import { type FeePayment } from "../../../server/withholding-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "withholding:read");
  const year = new URL(req.url).searchParams.get("year") ?? String(new Date().getFullYear());
  return Response.json({ year, report: await feePaymentStore.report(year), payments: await feePaymentStore.list(year) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "withholding:write");
  const body = (await req.json()) as FeePayment;
  if (!body.payee || !body.category || typeof body.base !== "number" || body.base <= 0) return Response.json({ error: "支払先・区分・正の報酬額(税抜)が必要です" }, { status: 400 });
  const paidAt = body.paidAt && /^\d{4}-\d{2}-\d{2}/.test(body.paidAt) ? body.paidAt : new Date().toISOString().slice(0, 10);
  const view = await feePaymentStore.record({ payee: body.payee, category: body.category, base: body.base, paidAt });
  await auditActions.record(user!.email, "withholding.record", `payee:${body.payee}`, { after: { base: body.base, withholding: view.withholding } });
  return Response.json(view, { status: 201 });
}

export const GET = withApiObservability("/api/withholding", handleGET);
export const POST = withApiObservability("/api/withholding", handlePOST);
