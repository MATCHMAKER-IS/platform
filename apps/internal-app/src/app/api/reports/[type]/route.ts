/** レポート生成(GET ?format=csv|html)。売上/売掛/在庫レポートをCSVまたは印刷用HTMLで出力。accounting:read または inventory:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, userCan } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, inventoryStore } from "../../../../server/platform-services.js";
import { salesReport, receivablesReport, inventoryReport, reportToCsv, reportToHtml, reportToSheet, filterInvoices, filterLabel, type Report, type ReportFilter } from "../../../../server/reports.js";
import { writeWorkbook } from "@platform/xlsx";

async function handleGET(req: Request, ctx: { params: Promise<{ type: string }> }): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const { type } = await ctx.params;
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "html";
  const filter: ReportFilter = { ...(sp.get("from") ? { from: sp.get("from")! } : {}), ...(sp.get("to") ? { to: sp.get("to")! } : {}), ...(sp.get("partner") ? { partner: sp.get("partner")! } : {}) };
  const now = new Date();

  let report: Report;
  if (type === "sales" || type === "receivables") {
    if (!userCan(user, "accounting:read")) return Response.json({ error: "権限がありません" }, { status: 403 });
    const invoices = filterInvoices(await invoiceStore.list(), filter);
    report = type === "sales"
      ? salesReport(invoices.map((i) => ({ number: i.number, billTo: i.billTo, total: i.totals?.total ?? 0, balance: i.balance ?? 0 })), now)
      : receivablesReport(invoices.map((i) => ({ number: i.number, billTo: i.billTo, balance: i.balance ?? 0, dueDate: i.dueDate, status: i.status })), now);
  } else if (type === "inventory") {
    if (!userCan(user, "inventory:read") && !userCan(user, "inventory:write")) return Response.json({ error: "権限がありません" }, { status: 403 });
    const stock = await inventoryStore.status();
    report = inventoryReport(stock.map((s) => ({ sku: s.product.sku, name: s.product.name, onHand: s.summary.onHand, needsReorder: s.needsReorder, suggestedOrderQty: s.suggestedOrderQty })), now);
  } else {
    return Response.json({ error: "未知のレポート種別です" }, { status: 404 });
  }

  const flabel = filterLabel(filter);
  if (flabel) report.title = report.title + " " + flabel;
  if (format === "xlsx") {
    const result = await writeWorkbook([reportToSheet(report)]);
    if (!result.ok) return Response.json({ error: "Excel の生成に失敗しました" }, { status: 500 });
    return new Response(result.value as BodyInit, { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="report-${type}-${now.toISOString().slice(0, 10)}.xlsx"` } });
  }
  if (format === "csv") {
    return new Response(reportToCsv(report), { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="report-${type}-${now.toISOString().slice(0, 10)}.csv"` } });
  }
  return new Response(reportToHtml(report), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const GET = withApiObservability("/api/reports/[type]", handleGET);
