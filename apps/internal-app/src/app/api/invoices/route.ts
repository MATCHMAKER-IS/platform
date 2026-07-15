/** 請求書: 一覧(GET)・作成(POST)。閲覧は invoice:read、作成は invoice:write。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { invoiceStore, partnerStore, periodLockStore, auditActions, settingsStore } from "../../../server/platform-services.js";
import { applyDefaultTaxRate } from "../../../server/tax-default.js";
import { emitEvent } from "../../../server/webhook-emit.js";
import { searchIndexStore } from "../../../server/platform-services.js";
import { invoiceToDoc } from "../../../server/entity-search.js";
import { type InvoiceHeader, type InvoiceLine } from "@platform/invoice";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:read");
  return Response.json({ invoices: await invoiceStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "invoice:write");
  const body = (await req.json()) as InvoiceHeader & { lines: InvoiceLine[]; partnerCode?: string };
  // 取引先コードが指定されていればマスタから宛先名を解決（名称の二重入力を解消）
  let billTo = body.billTo;
  if (body.partnerCode) {
    const partner = await partnerStore.get(body.partnerCode);
    if (!partner) return Response.json({ error: "指定された取引先が見つかりません" }, { status: 400 });
    billTo = partner.name;
  }
  if (!billTo || !body.issueDate || !body.dueDate) return Response.json({ error: "宛先(または取引先コード)・発行日・支払期限は必須です" }, { status: 400 });
  // 番号は省略可: システム設定の接頭辞で自動採番
  if (!body.number) { const st = await settingsStore.get(); body.number = `${st.invoicePrefix}${Date.now()}`; }
  if (!Array.isArray(body.lines) || body.lines.length === 0) return Response.json({ error: "明細を 1 行以上入力してください" }, { status: 400 });
  if (await invoiceStore.get(body.number)) return Response.json({ error: "同じ番号の請求書が既にあります" }, { status: 409 });
  if ((await periodLockStore.lockedSet()).has(body.issueDate.slice(0, 7))) return Response.json({ error: `${body.issueDate.slice(0, 7)} は締め済みのため起票できません` }, { status: 409 });
  const { lines, partnerCode: _pc, ...header } = body;
  const st = await settingsStore.get();
  const ratedLines = applyDefaultTaxRate(lines as unknown as ({ taxRate?: number } & Record<string, unknown>)[], st.consumptionTaxRate) as unknown as typeof lines;
  const rec = await invoiceStore.create({ ...header, billTo }, ratedLines);
  await emitEvent("invoice.created", { number: rec.number, billTo });
  await searchIndexStore.upsert([invoiceToDoc({ number: rec.number, billTo, total: rec.totals?.total })]);
  await auditActions.record(user!.email, "invoice.create", `invoice:${rec.number}`, { after: { total: rec.totals.total } });
  return Response.json(rec, { status: 201 });
}

export const GET = withApiObservability("/api/invoices", handleGET);
export const POST = withApiObservability("/api/invoices", handlePOST);
