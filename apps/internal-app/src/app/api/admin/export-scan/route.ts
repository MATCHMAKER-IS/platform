/**
 * エクスポート実行スキャン(POST)。期限が来たスケジュールのエクスポートを実行し履歴に記録。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { exportScheduleStore, exportRunStore, invoiceStore, partnerStore, auditLog, userStore, settingsStore } from "../../../../server/platform-services";
import { dueSchedules, type ExportType } from "../../../../server/export-schedule";
import { buildBackup } from "../../../../server/backup";

async function authorized(req: Request): Promise<boolean> {
  const token = featureEnv.CRON_TOKEN;
  if (token && req.headers.get("x-cron-token") === token) return true;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return !!user && user.roles.includes("admin");
}

/** 種別ごとに件数を算出（実運用ではここでストレージへ書き出す）。 */
async function runExport(type: ExportType): Promise<number> {
  if (type === "partners") return (await partnerStore.list()).length;
  if (type === "invoices") return (await invoiceStore.list()).length;
  if (type === "audit") return (await auditLog.query({ limit: 100000 })).length;
  // backup: 主要データをまとめて件数を算出
  const [invoices, partners, users, settings, audit] = await Promise.all([invoiceStore.list(), partnerStore.list(), userStore.list(), settingsStore.get(), auditLog.query({ limit: 100000 })]);
  const bundle = buildBackup([{ name: "invoices", records: invoices }, { name: "partners", records: partners }, { name: "users", records: users }, { name: "settings", records: [settings] }, { name: "audit", records: audit }], new Date());
  return bundle.totalRecords;
}

async function handlePOST(req: Request): Promise<Response> {
  if (!(await authorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const now = new Date();
  const due = dueSchedules(await exportScheduleStore.list(), now);
  const results: { type: ExportType; recordCount: number }[] = [];
  for (const sched of due) {
    try {
      const recordCount = await runExport(sched.type);
      await exportRunStore.add({ type: sched.type, at: now.toISOString(), status: "success", recordCount });
      await exportScheduleStore.markRun(sched.id, now.toISOString());
      results.push({ type: sched.type, recordCount });
    } catch (e) {
      await exportRunStore.add({ type: sched.type, at: now.toISOString(), status: "failed", recordCount: 0, note: String(e) });
    }
  }
  return Response.json({ ran: results.length, results });
}

export const POST = withApiObservability("/api/admin/export-scan", handlePOST);
