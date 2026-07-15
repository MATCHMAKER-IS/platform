/** 請求書: 適格請求書レイアウトの HTML(GET)。invoice:read が必要。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { invoiceStore, settingsStore } from "../../../../../server/platform-services.js";
import { renderInvoiceHtml } from "@platform/invoice";

async function handleGET(req: Request, ctx: { params: Promise<{ number: string }> }): Promise<Response> {
  const { number } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:read");
  const view = await invoiceStore.get(number);
  if (!view) return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  const html = renderInvoiceHtml(view, { issuerName: (await settingsStore.get()).companyName });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export const GET = withApiObservability("/api/invoices/[number]/html", handleGET);
