/** 見積: 一覧(GET)・作成(POST)。閲覧は quote:read、作成は quote:write。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { quoteStore, auditActions } from "../../../server/platform-services.js";
import { type QuoteHeaderInput } from "../../../server/quote-repo.js";
import { type InvoiceLine } from "@platform/invoice";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "quote:read");
  return Response.json({ quotes: await quoteStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "quote:write");
  const body = (await req.json()) as QuoteHeaderInput & { lines: InvoiceLine[] };
  if (!body.number || !body.billTo || !body.issueDate || !body.validUntil) return Response.json({ error: "番号・宛先・発行日・有効期限は必須です" }, { status: 400 });
  if (!Array.isArray(body.lines) || body.lines.length === 0) return Response.json({ error: "明細を 1 行以上入力してください" }, { status: 400 });
  if (await quoteStore.get(body.number)) return Response.json({ error: "同じ番号の見積が既にあります" }, { status: 409 });
  const { lines, ...header } = body;
  const rec = await quoteStore.create(header, lines);
  await auditActions.record(user!.email, "quote.create", `quote:${rec.number}`, { after: { total: rec.totals.total } });
  return Response.json(rec, { status: 201 });
}

export const GET = withApiObservability("/api/quotes", handleGET);
export const POST = withApiObservability("/api/quotes", handlePOST);
