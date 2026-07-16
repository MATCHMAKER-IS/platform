/**
 * ダッシュボード集約 API（GET）。未読通知数・最近の通知・最近のファイル・直近の監査イベントをまとめて返す。
 * 監査は管理者のみ含める。
 */
import { buildAlerts } from "../../../server/alerts";
import { collectAlertInput } from "../../../server/alert-collect";
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { notificationStore, fileManager, auditLog, mailboxStore, inquiryStore, invoiceStore, inventoryStore } from "../../../server/platform-services";
import { db } from "../../../server/services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const isAdmin = user!.roles.includes("admin");

  const [unreadCount, recentNotifications, recentFiles, pendingApprovals, myPendingRequests, mailboxUnread, openInquiries] = await Promise.all([
    notificationStore.unreadCount(user!.email),
    notificationStore.list(user!.email, { limit: 5 }),
    fileManager.list({ limit: 5 }),
    // 承認待ち総数(承認権限を持つ人向けの指標)
    countPendingApprovals(),
    // 自分が申請したもののうち承認待ち(担当タスク)
    countMyPendingRequests(user!.email),
    // 受信箱の未読数
    mailboxStore.unreadCount(user!.email),
    // 未対応のお問い合わせ
    inquiryStore.openCount(),
  ]);
  const activeAlerts = buildAlerts(await collectAlertInput()).length;
  // ウィジェット用: 売掛残高（未回収の請求残高合計）と在庫アラート（発注要）件数
  const [invoices, stock] = await Promise.all([invoiceStore.list(), inventoryStore.status()]);
  const receivablesTotal = invoices.reduce((sum, inv) => sum + (inv.balance ?? 0), 0);
  const inventoryAlerts = stock.filter((s) => s.needsReorder).length;

  const payload: {
    unreadCount: number;
    recentNotifications: unknown[];
    recentFiles: unknown[];
    pendingApprovals: number;
    myPendingRequests: number;
    recentAudit?: unknown[];
    auditValid?: boolean;
    mailboxUnread: number;
    openInquiries: number;
    activeAlerts: number;
    receivablesTotal: number;
    inventoryAlerts: number;
  } = { unreadCount, recentNotifications, recentFiles, pendingApprovals, myPendingRequests, mailboxUnread, openInquiries, activeAlerts, receivablesTotal, inventoryAlerts };

  if (isAdmin) {
    const [recentAudit, verification] = await Promise.all([auditLog.query({ limit: 5 }), auditLog.verify()]);
    payload.recentAudit = recentAudit;
    payload.auditValid = verification.valid;
  }

  return Response.json(payload);
}

/** 承認待ちの申請総数（expenseRequest.status = "pending"）。テーブルが無ければ 0。 */
async function countPendingApprovals(): Promise<number> {
  try {
    const delegate = (db as unknown as { expenseRequest?: { count(args: { where: { status: string } }): Promise<number> } }).expenseRequest;
    if (!delegate) return 0;
    return await delegate.count({ where: { status: "pending" } });
  } catch {
    return 0;
  }
}

/** 自分が申請したもののうち承認待ちの件数。 */
async function countMyPendingRequests(applicant: string): Promise<number> {
  try {
    const delegate = (db as unknown as { expenseRequest?: { count(args: { where: { status: string; applicant: string } }): Promise<number> } }).expenseRequest;
    if (!delegate) return 0;
    return await delegate.count({ where: { status: "pending", applicant } });
  } catch {
    return 0;
  }
}

export const GET = withApiObservability("/api/dashboard", handleGET);
