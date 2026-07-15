/** 自分が使える機能キーの一覧(GET)。ナビの表示/非表示に使う。認証ユーザー。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { featureAccessStore } from "../../../server/platform-services.js";
import { accessibleFeatures, FEATURE_CATALOG } from "../../../server/feature-access.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const rules = await featureAccessStore.get();
  const keys = accessibleFeatures(user.roles, rules);
  return Response.json({ accessible: keys, catalog: FEATURE_CATALOG.filter((f) => keys.includes(f.key)) });
}

export const GET = withApiObservability("/api/features", handleGET);
