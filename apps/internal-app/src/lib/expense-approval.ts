/**
 * 経費申請の承認ワークフロー。`@platform/workflow` を用いて申請→課長承認→部長承認、
 * 却下・差戻しを扱う。純ロジック(状態はアプリが保存する)。
 * @packageDocumentation
 */
import {
  startWorkflow, approve, reject, sendBack, currentStep,
  type WorkflowDefinition, type WorkflowState, type Actor,
} from "@platform/workflow";
import type { Expense } from "./expense.js";

/** 経費申請の承認フロー(2 段階)。 */
export const EXPENSE_WORKFLOW: WorkflowDefinition = {
  steps: [
    { name: "課長承認", approverRole: "manager" },
    { name: "部長承認", approverRole: "director" },
  ],
};

/** 高額申請の閾値(これ以上は部長承認まで必須)。 */
export const HIGH_AMOUNT_THRESHOLD = 100_000;

/** 経費申請。 */
export interface ExpenseRequest {
  id: string;
  applicant: string;
  expense: Expense;
  state: WorkflowState;
}

/** 申請を作成する。 */
export function submitExpense(id: string, applicant: string, expense: Expense): ExpenseRequest {
  return { id, applicant, expense, state: startWorkflow(EXPENSE_WORKFLOW) };
}

/** 現在ステップ名(完了時は状態ラベル)。 */
export function statusLabel(state: WorkflowState): string {
  if (state.status === "approved") return "承認済み";
  if (state.status === "rejected") return "却下";
  return currentStep(EXPENSE_WORKFLOW, state)?.name ?? "—";
}

/** actor が今このリクエストで取れるアクション。 */
export function availableActions(state: WorkflowState, actor: Actor): Array<"approve" | "reject" | "sendback"> {
  if (state.status !== "pending") return [];
  const step = currentStep(EXPENSE_WORKFLOW, state);
  if (!step || !actor.roles.includes(step.approverRole)) return [];
  const actions: Array<"approve" | "reject" | "sendback"> = ["approve", "reject"];
  if (state.currentStep > 0) actions.push("sendback");
  return actions;
}

/** 承認(Result を state に反映して新 request を返す。失敗時は元のまま + error)。 */
export function actOn(
  request: ExpenseRequest,
  actor: Actor,
  action: "approve" | "reject" | "sendback",
  reason?: string,
): { request: ExpenseRequest; error?: string } {
  const r =
    action === "approve" ? approve(EXPENSE_WORKFLOW, request.state, actor)
    : action === "reject" ? reject(EXPENSE_WORKFLOW, request.state, actor, reason ?? "")
    : sendBack(EXPENSE_WORKFLOW, request.state, actor, { reason });
  if (!r.ok) return { request, error: r.error.message };
  return { request: { ...request, state: r.value } };
}
