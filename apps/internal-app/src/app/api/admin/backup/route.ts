/** 管理: 統合バックアップ(GET)。主要データを1つのJSONバンドルで返す。管理者のみ。PIIは表示制御に従いマスク。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { invoiceStore, partnerStore, userStore, settingsStore, auditLog, auditActions } from "../../../../server/platform-services";
import { buildBackup, backupFilename, type Dataset } from "../../../../server/backup";
import { maskUserRecord } from "../../../../server/pii-view";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });

  const [invoices, partners, users, settings, audit] = await Promise.all([invoiceStore.list(), partnerStore.list(), userStore.list(), settingsStore.get(), auditLog.query({ limit: 5000 })]);
  const datasets: Dataset[] = [
    { name: "invoices", records: invoices },
    { name: "partners", records: partners },
    { name: "users", records: users.map((u) => maskUserRecord({ email: u.email, name: u.name, department: u.department, roles: u.roles, active: u.active }, false)) },
    { name: "settings", records: [settings] },
    { name: "audit", records: audit },
  ];
  const now = new Date();
  const bundle = buildBackup(datasets, now);
  await auditActions.record(user.email, "backup.export", `records:${bundle.totalRecords}`, {});
  return new Response(JSON.stringify(bundle, null, 2), { status: 200, headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${backupFilename(now)}"` } });
}

export const GET = withApiObservability("/api/admin/backup", handleGET);
