/** 管理: フィーチャーフラグ定義の取得(GET)・更新(POST)。管理者のみ。キルスイッチ/割合/バリアントを設定。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { flagStore, auditActions } from "../../../../server/platform-services.js";
import { type FlagDefinitions } from "@platform/flags";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ flags: await flagStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const defs = (await req.json()) as FlagDefinitions;
  const flags = await flagStore.update(defs);
  await auditActions.record(user.email, "flags.update", "definitions", { after: { count: Object.keys(defs).length } });
  return Response.json({ flags });
}

export const GET = withApiObservability("/api/admin/flags", handleGET);
export const POST = withApiObservability("/api/admin/flags", handlePOST);
