/**
 * 確認済み経費の DB 保存 + 承認ワークフロー(repository × workflow 連携例)。
 * 実際のアプリ(apps/*)のサービス層に置く想定。ここは型と流れの参照用。
 */
import { createRepository } from "@platform/db";
import { expenseToRow, type ExpenseRecord } from "@platform/report";
import { startWorkflow, approve, type WorkflowDefinition, type Actor } from "@platform/workflow";

// 経費の承認フロー(課長 → 経理)
export const EXPENSE_FLOW: WorkflowDefinition = {
  steps: [
    { name: "課長承認", approverRole: "manager" },
    { name: "経理承認", approverRole: "finance" },
  ],
};

/** db は createDb(...) の戻り値(Prisma クライアント)。 */
export function createExpenseService(db: { expense: Parameters<typeof createRepository>[0] }) {
  const repo = createRepository(db.expense, { softDeleteField: "deletedAt" });

  return {
    /** 確認済みの経費を保存(ワークフロー開始状態つき)。 */
    async save(record: ExpenseRecord) {
      const wf = startWorkflow(EXPENSE_FLOW);
      return repo.create({ ...expenseToRow(record), status: wf.status, currentStep: wf.currentStep, history: wf.history });
    },
    /** 承認して状態を更新。 */
    async approveStep(id: string, current: { status: string; currentStep: number; history: unknown[] }, actor: Actor) {
      const next = approve(EXPENSE_FLOW, current as never, actor);
      if (!next.ok) return next;
      return repo.update(id, { status: next.value.status, currentStep: next.value.currentStep, history: next.value.history });
    },
  };
}
