/**
 * 運用アラートの生成（アプリ側の組み合わせ）。
 * 期限超過の売掛・買掛・請求、承認待ちの勤怠、発注が必要な在庫を、通知メッセージの一覧に束ねる。純粋な組み立て。
 * @packageDocumentation
 */

/** アラートの深刻度。 */
export type AlertLevel = "warning" | "info";

/** 1 件のアラート。 */
export interface Alert {
  level: AlertLevel;
  title: string;
  body: string;
  href: string;
}

/** アラート生成の入力。 */
export interface AlertInput {
  receivablesOverdue: number;
  payablesOverdue: number;
  overdueInvoices: number;
  pendingApprovals: number;
  reorderCount: number;
}

const yen = (n: number) => `¥${n.toLocaleString()}`;

/** 入力から必要なアラートだけを組み立てる（該当が無い項目は出さない）。 */
export function buildAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  if (input.overdueInvoices > 0) alerts.push({ level: "warning", title: `期限超過の請求書が ${input.overdueInvoices} 件`, body: `売掛の期限超過は ${yen(input.receivablesOverdue)} です。督促を確認してください。`, href: "/invoices" });
  if (input.payablesOverdue > 0) alerts.push({ level: "warning", title: "支払期限を過ぎた買掛金があります", body: `買掛の期限超過は ${yen(input.payablesOverdue)} です。支払を確認してください。`, href: "/payables" });
  if (input.pendingApprovals > 0) alerts.push({ level: "info", title: `承認待ちの勤怠が ${input.pendingApprovals} 件`, body: "部下から申請された勤怠の承認をお願いします。", href: "/attendance-approvals" });
  if (input.reorderCount > 0) alerts.push({ level: "info", title: `発注が必要な在庫が ${input.reorderCount} 品目`, body: "発注点を割った品目があります。発注書を起票してください。", href: "/inventory" });
  return alerts;
}

/** 深刻度ごとの件数。 */
export function alertCounts(alerts: Alert[]): { warning: number; info: number } {
  return { warning: alerts.filter((a) => a.level === "warning").length, info: alerts.filter((a) => a.level === "info").length };
}
