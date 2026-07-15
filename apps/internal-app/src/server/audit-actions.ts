/**
 * 業務操作を監査ログに記録するヘルパ。各所で AuditEvent を組み立てて auditLog.record に流す。
 * これを経費・請求・チャット編集/削除・ファイル削除などの入口から呼ぶ。
 * @packageDocumentation
 */
import { type AuditEvent, type AuditEntry } from "@platform/audit";
import { type AuditLog } from "./audit-log.js";

/** 監査アクション記録。 */
export interface AuditActions {
  /** 任意イベントを記録。 */
  record(actor: string, action: string, target: string, changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> }): Promise<AuditEntry>;
  /** チャットメッセージ編集。 */
  chatEdit(actor: string, roomId: string, messageId: string, before: string, after: string): Promise<AuditEntry>;
  /** チャットメッセージ削除。 */
  chatDelete(actor: string, roomId: string, messageId: string): Promise<AuditEntry>;
  /** 掲示板投稿編集。 */
  boardEdit(actor: string, threadId: string, postId: string, before: string, after: string): Promise<AuditEntry>;
  /** 掲示板投稿削除。 */
  boardDelete(actor: string, threadId: string, postId: string): Promise<AuditEntry>;
  /** ファイル削除。 */
  fileDelete(actor: string, key: string): Promise<AuditEntry>;
  /** ファイルアップロード。 */
  fileUpload(actor: string, key: string, meta: { name: string; size: number; type: string }): Promise<AuditEntry>;
  /** 経費申請の提出。 */
  expenseSubmit(actor: string, expenseId: string, amount: number, category?: string): Promise<AuditEntry>;
  /** 経費申請の承認/却下/差戻し。 */
  expenseDecision(actor: string, requestId: string, action: "approve" | "reject" | "sendback", reason?: string): Promise<AuditEntry>;
  /** 請求書の発行。 */
  invoiceIssue(actor: string, invoiceId: string, amount: number): Promise<AuditEntry>;
}

/** 監査アクションを作る。 */
export function createAuditActions(auditLog: AuditLog, now: () => string = () => new Date().toISOString()): AuditActions {
  const rec = (event: Omit<AuditEvent, "at">) => auditLog.record({ at: now(), ...event });
  return {
    async record(actor, action, target, changes) {
      return rec({ actor, action, target, ...(changes ?? {}) });
    },
    async chatEdit(actor, roomId, messageId, before, after) {
      return rec({ actor, action: "chat.message.edit", target: `message:${roomId}/${messageId}`, before: { text: before }, after: { text: after } });
    },
    async chatDelete(actor, roomId, messageId) {
      return rec({ actor, action: "chat.message.delete", target: `message:${roomId}/${messageId}` });
    },
    async boardEdit(actor, threadId, postId, before, after) {
      return rec({ actor, action: "board.post.edit", target: `post:${threadId}/${postId}`, before: { body: before }, after: { body: after } });
    },
    async boardDelete(actor, threadId, postId) {
      return rec({ actor, action: "board.post.delete", target: `post:${threadId}/${postId}` });
    },
    async fileDelete(actor, key) {
      return rec({ actor, action: "file.delete", target: `file:${key}` });
    },
    async fileUpload(actor, key, meta) {
      return rec({ actor, action: "file.upload", target: `file:${key}`, after: { name: meta.name, size: meta.size, type: meta.type } });
    },
    async expenseSubmit(actor, expenseId, amount, category) {
      return rec({ actor, action: "expense.submit", target: `expense:${expenseId}`, after: { amount, ...(category !== undefined ? { category } : {}) } });
    },
    async expenseDecision(actor, requestId, action, reason) {
      return rec({ actor, action: `expense.${action}`, target: `request:${requestId}`, after: reason !== undefined ? { reason } : undefined });
    },
    async invoiceIssue(actor, invoiceId, amount) {
      return rec({ actor, action: "invoice.issue", target: `invoice:${invoiceId}`, after: { amount } });
    },
  };
}
