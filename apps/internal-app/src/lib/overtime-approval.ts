/**
 * 残業申請の承認ワークフロー。`@platform/workflow` を再利用。
 * 3時間以内は上長承認のみ、超過は部長承認まで必要(2段階)。
 * @packageDocumentation
 */
import {
  startWorkflow, approve, reject, sendBack, currentStep,
  type WorkflowDefinition, type WorkflowState, type Actor,
} from "@platform/workflow";

/** 部長承認が必要になる残業時間の閾値(分)。 */
export const LONG_OVERTIME_THRESHOLD = 3 * 60;

const SINGLE_STEP: WorkflowDefinition = { steps: [{ name: "上長承認", approverRole: "manager" }] };
const TWO_STEP: WorkflowDefinition = { steps: [{ name: "上長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }] };

/** 残業時間に応じたワークフロー定義を返す。 */
export function overtimeWorkflow(minutes: number): WorkflowDefinition {
  return minutes > LONG_OVERTIME_THRESHOLD ? TWO_STEP : SINGLE_STEP;
}

/** 残業申請。 */
export interface OvertimeRequest {
  id: string;
  applicant: string;
  date: string;
  minutes: number;
  reason: string;
  state: WorkflowState;
}

/** 残業申請を作成する。 */
export function submitOvertime(id: string, applicant: string, date: string, minutes: number, reason: string): OvertimeRequest {
  return { id, applicant, date, minutes, reason, state: startWorkflow(overtimeWorkflow(minutes)) };
}

/** 現在ステップ名(完了時は状態ラベル)。 */
export function statusLabel(req: OvertimeRequest): string {
  if (req.state.status === "approved") return "承認済み";
  if (req.state.status === "rejected") return "却下";
  return currentStep(overtimeWorkflow(req.minutes), req.state)?.name ?? "—";
}

/** actor が今このリクエストで取れるアクション。 */
export function availableActions(req: OvertimeRequest, actor: Actor): Array<"approve" | "reject" | "sendback"> {
  if (req.state.status !== "pending") return [];
  const step = currentStep(overtimeWorkflow(req.minutes), req.state);
  if (!step || !actor.roles.includes(step.approverRole)) return [];
  const actions: Array<"approve" | "reject" | "sendback"> = ["approve", "reject"];
  if (req.state.currentStep > 0) actions.push("sendback");
  return actions;
}

/** アクションを適用する(失敗時は元のまま + error)。 */
export function actOn(req: OvertimeRequest, actor: Actor, action: "approve" | "reject" | "sendback", reason?: string): { request: OvertimeRequest; error?: string } {
  const def = overtimeWorkflow(req.minutes);
  const r =
    action === "approve" ? approve(def, req.state, actor)
    : action === "reject" ? reject(def, req.state, actor, reason ?? "")
    : sendBack(def, req.state, actor, { reason });
  if (!r.ok) return { request: req, error: r.error.message };
  return { request: { ...req, state: r.value } };
}
