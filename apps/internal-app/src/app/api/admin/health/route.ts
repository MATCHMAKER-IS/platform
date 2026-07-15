/** 管理: システムヘルス(GET)。主要データ件数とチェック結果。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { userStore, partnerStore, invoiceStore, inquiryStore, auditLog } from "../../../../server/platform-services.js";
import { healthReport, type HealthCheck } from "../../../../server/health-summary.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const [users, partners, invoices, inquiries, verification] = await Promise.all([
    userStore.list(), partnerStore.list(), invoiceStore.list(), inquiryStore.list(), auditLog.verify(),
  ]);
  const counts = { ユーザー: users.length, 取引先: partners.length, 請求: invoices.length, 問い合わせ: inquiries.length };
  const checks: HealthCheck[] = [
    { name: "監査ログの整合性", ok: verification.valid, ...(verification.valid ? {} : { detail: "改ざんの疑いがあります" }) },
    { name: "有効な管理者", ok: users.some((u) => u.active && u.roles.includes("admin")), detail: "少なくとも1名の有効な管理者が必要" },
  ];
  return Response.json({ health: healthReport(counts, checks) });
}

export const GET = withApiObservability("/api/admin/health", handleGET);
