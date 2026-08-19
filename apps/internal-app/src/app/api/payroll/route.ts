/** 給与: 本人の当月給与明細(GET)。勤怠の月次集計と給与設定から算出。payroll:read。 */
import { withApiObservability } from "../../../server/instrument";
import { formatMonthJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { attendanceStore, wageStore, payrollProfileStore } from "../../../server/platform-services";
import { computePayroll, defaultWage } from "../../../server/payroll-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "payroll:read");
  const month = new URL(req.url).searchParams.get("month") ?? formatMonthJst();
  const summary = await attendanceStore.monthly(user!.email, month);
  const wage = (await wageStore.get(user!.email)) ?? defaultWage(user!.email);
  // **プロファイル未登録なら `undefined`。** `computePayroll` はその場合
  // 社会保険料を計算せず、`insurance` を省いたまま返す(未計算を明示する)。
  const profile = await payrollProfileStore.get(user!.email);
  const result = computePayroll(
    month, wage,
    { totalMinutes: summary.totalMinutes, overtimeMinutes: summary.overtimeMinutes, nightMinutes: summary.nightMinutes, holidayMinutes: summary.holidayMinutes, workedDays: summary.days.length },
    profile,
  );
  return Response.json(result);
}

export const GET = withApiObservability("/api/payroll", handleGET);
