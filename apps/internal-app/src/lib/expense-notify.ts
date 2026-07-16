/**
 * 経費申請の遷移から通知メール(宛先・件名・本文)を組み立てる純ロジック。
 * 送信自体は行わず、`@platform/workflow` の notificationForTransition/approverRecipients を利用する。
 * @packageDocumentation
 */
import { notificationForTransition, approverRecipients, type ApproverDirectory, type WorkflowState } from "@platform/workflow";
import { EXPENSE_WORKFLOW } from "./expense-approval";

/** 組み立てられたメール(送信は呼び出し側)。 */
export interface BuiltMail { to: string[]; subject: string; text: string }

/** {@link buildTransitionMails} の入力。 */
export interface TransitionMailInput {
  title: string;
  prev: WorkflowState;
  next: WorkflowState;
  directory: ApproverDirectory;
  applicantEmail?: string;
}

/**
 * 遷移に応じたメールを組み立てる。
 * - 次の承認ステップに進んだ → 次の承認者へ「承認依頼」
 * - 承認/却下で完了 → 申請者へ「結果通知」
 * 変化が無ければ空配列。
 */
export function buildTransitionMails(input: TransitionMailInput): BuiltMail[] {
  const note = notificationForTransition(input.prev, input.next, { title: input.title });
  if (!note) return [];
  const mails: BuiltMail[] = [];

  if (input.next.status === "pending") {
    const to = approverRecipients(EXPENSE_WORKFLOW, input.next, input.directory)
      .map((r) => r.email)
      .filter((e): e is string => Boolean(e));
    if (to.length > 0) {
      mails.push({ to, subject: `[承認依頼] ${note.text}`, text: `${note.text}\n\n承認をお願いします。` });
    }
  }

  if ((input.next.status === "approved" || input.next.status === "rejected") && input.applicantEmail) {
    mails.push({ to: [input.applicantEmail], subject: note.text, text: note.text });
  }

  return mails;
}
