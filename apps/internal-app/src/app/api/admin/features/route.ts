/** 管理: 機能アクセス設定。カタログ＋現在の規則取得(GET)・規則更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { featureAccessStore, auditActions } from "../../../../server/platform-services";
import { FEATURE_CATALOG, type FeatureRule } from "../../../../server/feature-access";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ catalog: FEATURE_CATALOG, rules: await featureAccessStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const patch = (await req.json()) as Record<string, Partial<FeatureRule>>;
  const rules = await featureAccessStore.update(patch);
  await auditActions.record(user.email, "features.update", "access", { after: patch as unknown as Record<string, unknown> });
  return Response.json({ rules });
}

export const GET = withApiObservability("/api/admin/features", handleGET);
export const POST = withApiObservability("/api/admin/features", handlePOST);
