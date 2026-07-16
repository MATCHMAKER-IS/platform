/** 固定資産: 減価償却スケジュール(GET)。asset:read。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { assetStore } from "../../../../../server/platform-services";
import { scheduleFor } from "../../../../../server/asset-repo";

async function handleGET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "asset:read");
  const asset = await assetStore.get(code);
  if (!asset) return Response.json({ error: "資産が見つかりません" }, { status: 404 });
  return Response.json({ asset, schedule: scheduleFor(asset) });
}

export const GET = withApiObservability("/api/assets/[code]/schedule", handleGET);
