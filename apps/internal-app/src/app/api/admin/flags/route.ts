/** 管理: フィーチャーフラグ定義の取得(GET)・更新(POST)。管理者のみ。キルスイッチ/割合/バリアントを設定。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { flagStore, auditActions } from "../../../../server/platform-services";
import { type FlagDefinitions } from "@platform/flags";
import { validate, z } from "@platform/validation";

/**
 * フラグ定義の形。
 *
 * **`as FlagDefinitions` は型の嘘だった。** 実行時には何も確かめないので、
 * `rolloutPercent: "全部"` や `variants: [{ weight: "多め" }]` が
 * **そのまま保存され**、評価のたびに壊れる。
 * フラグは**本番の挙動を切り替えるもの**なので、壊れ方が広い。
 */
const FlagRule = z.union([
  z.boolean(),
  z.object({
    enabled: z.boolean().optional(),
    // **0〜100 の範囲を守る。** 120 を入れても「120%」の意味は無い
    rolloutPercent: z.number().min(0).max(100).optional(),
    allow: z.array(z.record(z.string(), z.unknown())).optional(),
    deny: z.array(z.record(z.string(), z.unknown())).optional(),
    // **重みは非負。** 負の重みは配分の計算を壊す
    variants: z.array(z.object({ name: z.string().min(1), weight: z.number().nonnegative() })).optional(),
  }),
]);
const FlagInput = z.record(z.string().min(1), FlagRule);

function admin(req: Request) {
  const user = currentUser(req);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  return Response.json({ flags: await flagStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const parsed = validate(FlagInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const defs = parsed.value as FlagDefinitions;
  const flags = await flagStore.update(defs);
  await auditActions.record(user.email, "flags.update", "definitions", { after: { count: Object.keys(defs).length } });
  return Response.json({ flags });
}

export const GET = withApiObservability("/api/admin/flags", handleGET);
export const POST = withApiObservability("/api/admin/flags", handlePOST);
