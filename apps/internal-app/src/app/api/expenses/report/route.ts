/**
 * 月次レポートの Excel(.xlsx)ダウンロード API。
 * `buildMonthlyReport` のシートを `@platform/xlsx` の writeWorkbook で書き出す。
 */
import { writeWorkbook } from "@platform/xlsx";
import { withApiObservability } from "../../../../server/instrument";
import { buildMonthlyReport } from "../../../../lib/expense-report";
import { SAMPLE_EXPENSES } from "../../../../lib/sample-expenses";

async function handleGet(req: Request): Promise<Response> {
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return new Response("month は YYYY-MM 形式で指定してください", { status: 400 });
  }

  const { sheets } = buildMonthlyReport(SAMPLE_EXPENSES, month);
  const result = await writeWorkbook(sheets);
  if (!result.ok) {
    return new Response("Excel の生成に失敗しました", { status: 500 });
  }

  const body = new Blob([result.value as BlobPart]);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expense-report-${month}.xlsx"`,
    },
  });
}

export const GET = withApiObservability("/api/expenses/report", handleGet);
