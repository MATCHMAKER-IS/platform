/** 管理: 機能アクセス設定。カタログ＋現在の規則取得(GET)・規則更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * 機能アクセスの上書き。
 *
 * **`as Record<string, Partial<FeatureRule>>` は型の嘘だった。**
 * `roles: "admin"`(配列でない文字列)を送ると、権限判定が
 * **文字を 1 つずつ回して**意図しない結果になる。
 * 機能アクセスは**誰が何を見られるか**を決めるので、壊れ方が直接的。
 */
const FeaturePatch = z.record(
  z.string().min(1),
  z.object({
    enabled: z.boolean().optional(),
    roles: z.array(z.string()).optional(),
    actions: z.record(z.string(), z.array(z.string())).optional(),
  }),
);
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { featureAccessStore, auditActions } from "../../../../server/platform-services";
import { FEATURE_CATALOG, type FeatureRule } from "../../../../server/feature-access";

function admin(req: Request) {
  const user = currentUser(req);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  return Response.json({ catalog: FEATURE_CATALOG, rules: await featureAccessStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const parsed = validate(FeaturePatch, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const patch = parsed.value as Record<string, Partial<FeatureRule>>;
  const rules = await featureAccessStore.update(patch);
  await auditActions.record(user.email, "features.update", "access", { after: patch as unknown as Record<string, unknown> });
  return Response.json({ rules });
}

export const GET = withApiObservability("/api/admin/features", handleGET);
export const POST = withApiObservability("/api/admin/features", handlePOST);
