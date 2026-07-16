/** 請求書: PDF 出力(GET)。レンダラ設定時は PDF、未設定時はブラウザ印刷用の HTML を返す。invoice:read。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { invoiceStore, settingsStore } from "../../../../../server/platform-services";
import { getPdfService, wrapForPrint, DEFAULT_INVOICE_PDF_OPTIONS } from "../../../../../server/pdf-service";
import { renderInvoiceHtml } from "@platform/invoice";

async function handleGET(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:read");
  const view = await invoiceStore.get(number);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  const inner = renderInvoiceHtml(view, { issuerName: (await settingsStore.get()).companyName });
  const pdf = getPdfService();
  if (pdf) {
    const res = await pdf.fromHtml(wrapForPrint(inner, `請求書 ${number}`), DEFAULT_INVOICE_PDF_OPTIONS);
    if (res.ok) return new Response(res.value as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${number}.pdf"` } });
  }
  // レンダラ未設定: ブラウザの「印刷 → PDF 保存」で出力できる HTML を返す
  return new Response(wrapForPrint(inner, `請求書 ${number}`), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export const GET = withApiObservability("/api/invoices/[number]/pdf", handleGET);
