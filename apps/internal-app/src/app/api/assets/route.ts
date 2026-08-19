/** 固定資産: 台帳一覧＋サマリー(GET)・資産の登録(POST)。asset:read / asset:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { assetStore, auditActions } from "../../../server/platform-services";
import { viewOf, summarize, type FixedAsset } from "../../../server/asset-repo";
import { yearJst } from "@platform/datetime";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "asset:read");
  const year = Number(new URL(req.url).searchParams.get("year") ?? yearJst());
  const views = (await assetStore.list()).map((a) => viewOf(a, year));
  return Response.json({ year, assets: views, summary: summarize(views) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "asset:write");
  const body = (await req.json().catch(() => ({}))) as FixedAsset;
  // **取得価額は整数で受ける。** 小数を通すと Int 列への書き込みで落ちる。
  const badCost = !Number.isSafeInteger(body.cost) || body.cost <= 0;
  if (!body.code || !body.name || !/^\d{4}-\d{2}-\d{2}/.test(body.acquiredOn ?? "") || badCost || !(body.usefulLifeYears > 0)) {
    return Response.json({ error: "コード・名称・取得日・1 円以上の整数の取得価額・耐用年数が必要です" }, { status: 400 });
  }
  const method = body.method === "declining_balance" ? "declining_balance" : "straight_line";
  const saved = await assetStore.upsert({ code: body.code, name: body.name, acquiredOn: body.acquiredOn, cost: body.cost, usefulLifeYears: body.usefulLifeYears, method });
  await auditActions.record(user!.email, "asset.upsert", `asset:${saved.code}`, { after: { cost: saved.cost, method } });
  return Response.json(saved, { status: 201 });
}

export const GET = withApiObservability("/api/assets", handleGET);
export const POST = withApiObservability("/api/assets", handlePOST);
