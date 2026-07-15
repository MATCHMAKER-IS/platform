/** 給与: 本人の当月給与明細(GET)。勤怠の月次集計と給与設定から算出。payroll:read。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { attendanceStore, wageStore } from "../../../server/platform-services.js";
import { computePayroll, defaultWage } from "../../../server/payroll-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "payroll:read");
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const summary = await attendanceStore.monthly(user!.email, month);
  const wage = (await wageStore.get(user!.email)) ?? defaultWage(user!.email);
  const result = computePayroll(month, wage, { totalMinutes: summary.totalMinutes, overtimeMinutes: summary.overtimeMinutes, nightMinutes: summary.nightMinutes, holidayMinutes: summary.holidayMinutes, workedDays: summary.days.length });
  return Response.json(result);
}

export const GET = withApiObservability("/api/payroll", handleGET);
