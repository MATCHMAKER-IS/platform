/**
 * ワークフローの状態遷移から通知メッセージを作る(純関数・@platform/notify と組み合わせる)。
 * @packageDocumentation
 */
import type { WorkflowState } from "./index";

/** 通知内容。 */
export interface WorkflowNotification {
  level: "info" | "warn" | "error";
  text: string;
}

/**
 * 遷移(prev→next)に応じた通知を返す。変化が無ければ null。
 * @example
 * ```ts
 * const n = notificationForTransition(prev, next, { title: "経費申請#123" });
 * if (n) await notifier.notify(n);
 * ```
 *
 * @param request 申請
 * @param from 前の状態
 * @param to 次の状態
 * @returns 通知の内容。**通知不要な遷移なら null**(全部の遷移を通知すると、誰も読まなくなる)
 */
export function notificationForTransition(
  prev: WorkflowState,
  next: WorkflowState,
  meta: { title?: string } = {},
): WorkflowNotification | null {
  const title = meta.title ?? "申請";
  if (prev.status === next.status && prev.currentStep === next.currentStep) return null;
  if (next.status === "approved") return { level: "info", text: `${title}が承認されました` };
  if (next.status === "rejected") {
    const last = next.history[next.history.length - 1];
    return { level: "warn", text: `${title}が却下されました${last?.reason ? `(理由: ${last.reason})` : ""}` };
  }
  if (next.status === "pending" && next.currentStep > prev.currentStep) {
    return { level: "info", text: `${title}が次の承認ステップに進みました(ステップ${next.currentStep + 1})` };
  }
  return null;
}

/** ロール → 宛先ディレクトリ。 */
export interface ApproverDirectory {
  [role: string]: { name?: string; email?: string; slackId?: string }[];
}

/**
 * 現在 pending のステップを承認できる担当者の宛先を返す(通知の送り先)。
 * @example
 * ```ts
 * const to = approverRecipients(def, state, directory);
 * for (const p of to) await mailer.sendMail({ to: p.email!, subject, text });
 * ```
 * @param request 申請
 * @param delegations 委任の配列
 */
export function approverRecipients(
  def: { steps: { approverRole: string }[] },
  state: WorkflowState,
  directory: ApproverDirectory,
): { name?: string; email?: string; slackId?: string }[] {
  if (state.status !== "pending") return [];
  const step = def.steps[state.currentStep];
  if (!step) return [];
  return directory[step.approverRole] ?? [];
}
