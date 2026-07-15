/** 管理: 権限マトリクス(GET)。ロール×機能の対応表。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { APP_POLICY } from "../../../../server/policy.js";
import { permissionMatrix } from "../../../../server/permission-matrix.js";

const ROLES = ["employee", "editor", "manager", "finance", "admin"];

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ matrix: permissionMatrix(APP_POLICY, ROLES) });
}

export const GET = withApiObservability("/api/admin/permissions", handleGET);
