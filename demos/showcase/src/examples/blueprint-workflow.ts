/**
 * 承認フロー → 通知の実配線(純ロジックの合成)。
 * ブループリント/ワークフローの進行に応じて、次の承認者や申請者への通知メッセージを組み立てる。
 * 文面は @platform/notify の renderTemplate、送信は createNotifier(チャネル)に渡す。
 * @packageDocumentation
 */
import { renderTemplate } from "@platform/notify";
import { pendingApprovalRole, type Expense } from "./blueprint-integration.js";

/** 通知メッセージ(宛先ロールと本文)。 */
export interface ApprovalNotification {
  /** 宛先(ロール。実送信時はロール→ユーザーに解決)。 */
  toRole: string;
  subject: string;
  body: string;
}

const APPROVAL_REQUEST = "経費申請「{{purpose}}」({{amount}}円)の{{role}}承認をお願いします。";
const APPROVED = "経費申請「{{purpose}}」({{amount}}円)が承認されました。";
const REJECTED = "経費申請「{{purpose}}」({{amount}}円)は却下されました。";

/** 提出/承認後の状態から、次に送るべき通知を決める。無ければ null。 */
export function notificationFor(expense: Expense, requesterRole = "applicant"): ApprovalNotification | null {
  const status = expense.approval?.status;
  if (status === "pending") {
    const role = pendingApprovalRole(expense);
    if (!role) return null;
    return {
      toRole: role,
      subject: "承認依頼",
      body: renderTemplate(APPROVAL_REQUEST, { purpose: expense.purpose ?? "", amount: expense.amount, role }),
    };
  }
  if (expense.state === "approved") {
    return { toRole: requesterRole, subject: "承認完了", body: renderTemplate(APPROVED, { purpose: expense.purpose ?? "", amount: expense.amount }) };
  }
  if (expense.state === "rejected") {
    return { toRole: requesterRole, subject: "却下", body: renderTemplate(REJECTED, { purpose: expense.purpose ?? "", amount: expense.amount }) };
  }
  return null;
}
