/** 固定資産: 台帳一覧＋サマリー(GET)・資産の登録(POST)。asset:read / asset:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { assetStore, auditActions } from "../../../server/platform-services";
import { viewOf, summarize, type FixedAsset } from "../../../server/asset-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "asset:read");
  const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
  const views = (await assetStore.list()).map((a) => viewOf(a, year));
  return Response.json({ year, assets: views, summary: summarize(views) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "asset:write");
  const body = (await req.json()) as FixedAsset;
  if (!body.code || !body.name || !/^\d{4}-\d{2}-\d{2}/.test(body.acquiredOn ?? "") || !(body.cost > 0) || !(body.usefulLifeYears > 0)) return Response.json({ error: "コード・名称・取得日・正の取得価額・耐用年数が必要です" }, { status: 400 });
  const method = body.method === "declining_balance" ? "declining_balance" : "straight_line";
  const saved = await assetStore.upsert({ code: body.code, name: body.name, acquiredOn: body.acquiredOn, cost: body.cost, usefulLifeYears: body.usefulLifeYears, method });
  await auditActions.record(user!.email, "asset.upsert", `asset:${saved.code}`, { after: { cost: saved.cost, method } });
  return Response.json(saved, { status: 201 });
}

export const GET = withApiObservability("/api/assets", handleGET);
export const POST = withApiObservability("/api/assets", handlePOST);
