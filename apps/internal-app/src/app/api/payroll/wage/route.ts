/** 給与設定: 一覧(GET)・登録更新(PUT)。payroll:admin(finance/admin)。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { wageStore, auditActions } from "../../../../server/platform-services";
import { type WageConfig } from "../../../../server/payroll-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "payroll:admin");
  return Response.json({ wages: await wageStore.list() });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "payroll:admin");
  const body = (await req.json().catch(() => ({}))) as WageConfig;
  // **時給は円単位の整数。** `1234.5678` のような値を受けると、
  // 毎月の計算で**丸めの誤差が積み上がり**、明細の内訳と合計が合わなくなる。
  // 計算側(`calcPay`)は内訳を丸めてから足しているので、**入り口で絞れば誤差は出ない**。
  // 端数のある時給が必要になったら、**円未満をどう扱うかを決めてから**緩めること
  if (!body.userId || typeof body.hourlyWage !== "number"
      || !Number.isInteger(body.hourlyWage) || body.hourlyWage <= 0) {
    return Response.json({ error: "userId と、1 円単位の正の時給が必要です" }, { status: 400 });
  }
  const saved = await wageStore.set({ userId: body.userId, hourlyWage: body.hourlyWage, allowances: body.allowances ?? [], deductions: body.deductions ?? [] });
  await auditActions.record(user!.email, "payroll.wage", `user:${saved.userId}`, { after: { hourlyWage: saved.hourlyWage } });
  return Response.json(saved);
}

export const GET = withApiObservability("/api/payroll/wage", handleGET);
export const PUT = withApiObservability("/api/payroll/wage", handlePUT);
