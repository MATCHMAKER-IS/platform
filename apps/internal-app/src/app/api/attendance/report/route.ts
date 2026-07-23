/** 勤怠月次レポートの Excel(.xlsx)ダウンロード API。 */
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { withApiObservability } from "../../../../server/instrument";
import { writeWorkbook } from "@platform/xlsx";
import { attendanceReportSheets } from "../../../../lib/attendance-report";
import { SAMPLE_ATTENDANCE } from "../../../../lib/sample-attendance";

async function handleGET(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:read");
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return new Response("month は YYYY-MM 形式で指定してください", { status: 400 });
  }
  const sheets = attendanceReportSheets(SAMPLE_ATTENDANCE, month);
  const result = await writeWorkbook(sheets);
  if (!result.ok) {
    return new Response("Excel の生成に失敗しました", { status: 500 });
  }
  const body = new Blob([result.value as BlobPart]);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${month}.xlsx"`,
    },
  });
}

export const GET = withApiObservability("/api/attendance/report", handleGET);
