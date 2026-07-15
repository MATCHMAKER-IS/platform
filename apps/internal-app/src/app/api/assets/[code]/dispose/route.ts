/** 固定資産: 除却・売却(POST)。資産に処分を記録し、除却損・売却損益の仕訳を返す。asset:write。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { assetStore, auditActions } from "../../../../../server/platform-services.js";
import { disposalJournal } from "../../../../../server/disposal-journal.js";
import { journalToRows } from "@platform/accounting";

async function handlePOST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "asset:write");
  const body = (await req.json()) as { type: "retire" | "sell"; disposedOn: string; proceeds?: number };
  if (!["retire", "sell"].includes(body.type) || !/^\d{4}-\d{2}-\d{2}/.test(body.disposedOn ?? "")) return Response.json({ error: "type(retire/sell)・disposedOn(日付)が必要です" }, { status: 400 });
  if (body.type === "sell" && !(typeof body.proceeds === "number" && body.proceeds >= 0)) return Response.json({ error: "売却には0以上の売却額が必要です" }, { status: 400 });
  const asset = await assetStore.get(code);
  if (!asset) return Response.json({ error: "資産が見つかりません" }, { status: 404 });
  if (asset.disposedOn) return Response.json({ error: "この資産は既に処分済みです" }, { status: 409 });
  const disposed = { ...asset, disposedOn: body.disposedOn, disposalType: body.type, ...(body.type === "sell" ? { proceeds: body.proceeds } : {}) };
  await assetStore.upsert(disposed);
  const entry = disposalJournal(disposed);
  await auditActions.record(user!.email, `asset.${body.type}`, `asset:${code}`, { after: { disposedOn: body.disposedOn, proceeds: body.proceeds ?? 0 } });
  return Response.json({ asset: disposed, entry, rows: journalToRows([entry]) }, { status: 201 });
}

export const POST = withApiObservability("/api/assets/[code]/dispose", handlePOST);
