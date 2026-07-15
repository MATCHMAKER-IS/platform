/** 給与設定: 一覧(GET)・登録更新(PUT)。payroll:admin(finance/admin)。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { wageStore, auditActions } from "../../../../server/platform-services.js";
import { type WageConfig } from "../../../../server/payroll-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "payroll:admin");
  return Response.json({ wages: await wageStore.list() });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "payroll:admin");
  const body = (await req.json()) as WageConfig;
  if (!body.userId || typeof body.hourlyWage !== "number" || body.hourlyWage <= 0) return Response.json({ error: "userId と正の時給が必要です" }, { status: 400 });
  const saved = await wageStore.set({ userId: body.userId, hourlyWage: body.hourlyWage, allowances: body.allowances ?? [], deductions: body.deductions ?? [] });
  await auditActions.record(user!.email, "payroll.wage", `user:${saved.userId}`, { after: { hourlyWage: saved.hourlyWage } });
  return Response.json(saved);
}

export const GET = withApiObservability("/api/payroll/wage", handleGET);
export const PUT = withApiObservability("/api/payroll/wage", handlePUT);
