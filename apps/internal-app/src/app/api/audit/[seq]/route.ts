/** 監査エントリ詳細 API（GET）。before/after のフィールド差分つき。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { auditLog } from "../../../../server/platform-services";

async function handleGET(req: Request, ctx: { params: Promise<{ seq: string }> }): Promise<Response> {
  const { seq } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "audit:read");
  const n = Number(seq);
  if (!Number.isInteger(n)) return Response.json({ error: "seq が不正です" }, { status: 400 });
  const detail = await auditLog.entry(n);
  if (!detail) return Response.json({ error: "エントリが見つかりません" }, { status: 404 });
  return Response.json(detail);
}

export const GET = withApiObservability("/api/audit/[seq]", handleGET);
