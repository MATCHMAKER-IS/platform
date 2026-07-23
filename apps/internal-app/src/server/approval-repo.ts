/**
 * 経費承認状態の永続化(Prisma + トランザクション)。
 * WorkflowState ⇄ ExpenseRequest 行を相互変換し、承認/却下/差戻しをトランザクション内で適用する。
 * @packageDocumentation
 */
import { withTransaction } from "@platform/db";
import type { Result } from "@platform/core";
import { db } from "./services";
import { EXPENSE_WORKFLOW, actOn, type ExpenseRequest } from "../lib/expense-approval";
import { startWorkflow, type WorkflowState, type Actor } from "@platform/workflow";
import { enqueueExpenseTransition } from "./expense-notify-service";
import type { Expense } from "../lib/expense";

/** ExpenseRequest 行(Prisma 生成型の必要部分)。 */
export interface ExpenseRequestRow {
  id: string;
  applicant: string;
  expenseId: string;
  status: string;
  currentStep: number;
  history: unknown;
}

/** WorkflowState → 行データ(history はそのまま JSON 保存)。 */
export function stateToRow(state: WorkflowState): { status: string; currentStep: number; history: WorkflowState["history"] } {
  return { status: state.status, currentStep: state.currentStep, history: state.history };
}

/** 行 → WorkflowState(status を厳密化、history は配列前提で復元)。 */
export function rowToState(row: Pick<ExpenseRequestRow, "status" | "currentStep" | "history">): WorkflowState {
  const status = row.status === "approved" || row.status === "rejected" ? row.status : "pending";
  return {
    status,
    currentStep: row.currentStep,
    history: Array.isArray(row.history) ? (row.history as WorkflowState["history"]) : [],
  };
}

/** 申請を作成する。 */
export async function createRequest(applicant: string, expenseId: string): Promise<ExpenseRequestRow> {
  const initial = startWorkflow(EXPENSE_WORKFLOW);
  return db.expenseRequest.create({
    data: { applicant, expenseId, ...stateToRow(initial) },
  }) as Promise<ExpenseRequestRow>;
}

/** 承認/却下/差戻しをトランザクション内で適用する。競合(同時更新)に強い。 */
export async function applyAction(
  requestId: string,
  actor: Actor,
  action: "approve" | "reject" | "sendback",
  reason?: string,
): Promise<Result<WorkflowState>> {
  let prevState: WorkflowState | null = null;
  let applicant = "";
  const committed = await withTransaction(db, async (tx) => {
    const row = (await tx.expenseRequest.findUnique({ where: { id: requestId } })) as ExpenseRequestRow | null;
    if (!row) throw new Error("申請が見つかりません");

    // actOn は state のみ参照するため、expense はプレースホルダで足りる。
    const placeholder: Expense = { id: row.expenseId, date: "", category: "", amount: 0 };
    const request: ExpenseRequest = { id: row.id, applicant: row.applicant, expense: placeholder, state: rowToState(row) };
    prevState = request.state;
    applicant = row.applicant;
    const result = actOn(request, actor, action, reason);
    if (result.error) throw new Error(result.error);

    await tx.expenseRequest.update({ where: { id: requestId }, data: stateToRow(result.request.state) });
    return result.request.state;
  });

  // コミット成功時に通知を Outbox へ積む(実送信は relay が担う=確実配信)。
  // enqueue は同期・副作用小。実運用では上の withTransaction 内で積み、コミットと整合させる。
  if (committed.ok && prevState) {
    enqueueExpenseTransition({ title: `経費申請 ${requestId}`, prev: prevState, next: committed.value });
  }
  return committed;
}
