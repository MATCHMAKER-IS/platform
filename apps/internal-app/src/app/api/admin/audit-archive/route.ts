/**
 * 管理: 監査アーカイブ(GET ?before=ISO)。指定日以前の監査エントリを整合性チェックサム付きでダウンロード。管理者のみ。
 * 監査はハッシュチェーンのため破壊的削除は行わず、長期保管用のエクスポートを提供する。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { auditLog, auditActions } from "../../../../server/platform-services";
import { buildAuditArchive, auditArchiveFilename, type AuditRowLike } from "../../../../server/audit-archive";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const before = new URL(req.url).searchParams.get("before") ?? new Date().toISOString();
  const rows = await auditLog.query({ limit: 100000 });
  const archive = buildAuditArchive(rows as unknown as AuditRowLike[], before, new Date());
  await auditActions.record(user.email, "audit.archive", `until:${before.slice(0, 10)} count:${archive.count}`, {});
  return new Response(JSON.stringify(archive, null, 2), { status: 200, headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${auditArchiveFilename(before)}"` } });
}

export const GET = withApiObservability("/api/admin/audit-archive", handleGET);
