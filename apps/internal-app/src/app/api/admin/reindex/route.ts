/** 管理: 検索インデックスの再構築(POST)。請求・取引先・監査から索引を作り直す。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, partnerStore, auditLog, searchIndexStore } from "../../../../server/platform-services.js";
import { invoiceToDoc, partnerToDoc, auditToDoc, type EntityDoc } from "../../../../server/entity-search.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const [invoices, partners, audit] = await Promise.all([invoiceStore.list(), partnerStore.list(), auditLog.query({ limit: 2000 })]);
  const docs: EntityDoc[] = [
    ...invoices.map((inv) => invoiceToDoc({ number: inv.number, billTo: inv.billTo, total: inv.totals?.total })),
    ...partners.map((p) => partnerToDoc({ code: p.code, name: p.name })),
    ...audit.map((r) => auditToDoc({ seq: r.seq, actor: r.actor, action: r.action, target: r.target })),
  ];
  await searchIndexStore.clear();
  await searchIndexStore.upsert(docs);
  return Response.json({ indexed: docs.length });
}

export const POST = withApiObservability("/api/admin/reindex", handlePOST);
