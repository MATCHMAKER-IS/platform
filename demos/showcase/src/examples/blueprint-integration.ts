/**
 * ブループリント × 承認ワークフローの統合(純ロジックの合成)。
 * 全体の手順は @platform/blueprint で定義し、「承認」段階は @platform/workflow の
 * 金額ルーティング + 多段承認に委譲する。金額により承認者の段数が変わる。
 * @packageDocumentation
 */
import { applyTransition, evaluateTransition, type Blueprint } from "@platform/blueprint";
import { routeByAmount, startWorkflow, approve, type AmountTier, type WorkflowState, type Actor } from "@platform/workflow";

/** 経費レコード(承認ワークフローの状態を内包)。 */
export interface Expense extends Record<string, unknown> {
  state: "draft" | "submitted" | "approved" | "rejected";
  amount: number;
  purpose?: string;
  /** 進行中の承認ワークフロー状態。 */
  approval?: WorkflowState;
}

/** 金額帯ごとの承認段数(少額は課長のみ、高額は課長→部長→役員)。 */
export const APPROVAL_TIERS: AmountTier[] = [
  { under: 30000, steps: [{ name: "課長承認", approverRole: "manager" }] },
  { under: 100000, steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }] },
  { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }, { name: "役員承認", approverRole: "executive" }] },
];

/** 経費の全体プロセス(承認は workflow に委譲)。 */
export const expenseBlueprint: Blueprint<Expense["state"], Expense> = {
  initial: "draft",
  states: ["draft", "submitted", "approved", "rejected"],
  final: ["approved", "rejected"],
  transitions: [
    { from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["startApproval"] },
    { from: "submitted", to: "approved", name: "承認完了", condition: (e) => e.approval?.status === "approved", actions: ["postJournal"] },
    { from: "submitted", to: "rejected", name: "却下", condition: (e) => e.approval?.status === "rejected" },
  ],
};

/** 提出: ブループリントで submitted にし、金額に応じた承認ワークフローを開始する。 */
export function submit(expense: Expense): { ok: boolean; expense: Expense; errors: string[] } {
  const t = applyTransition(expenseBlueprint, expense, "提出");
  if (!t.ok) return { ok: false, expense, errors: t.errors };
  const def = routeByAmount(expense.amount, APPROVAL_TIERS);
  return { ok: true, expense: { ...t.record, approval: startWorkflow(def) }, errors: [] };
}

/** 承認: workflow の現在ステップを承認し、全段完了ならブループリントを「承認完了」へ進める。 */
export function approveStep(expense: Expense, actor: Actor): { ok: boolean; expense: Expense; errors: string[] } {
  if (!expense.approval) return { ok: false, expense, errors: ["承認ワークフローが開始されていません"] };
  const def = routeByAmount(expense.amount, APPROVAL_TIERS);
  const result = approve(def, expense.approval, actor);
  if (!result.ok) return { ok: false, expense, errors: [result.error.message] };

  const next: Expense = { ...expense, approval: result.value };
  // 全段承認されたらブループリントを前進(仕訳起票アクションが発火)
  if (result.value.status === "approved") {
    const done = applyTransition(expenseBlueprint, next, "承認完了");
    if (done.ok) return { ok: true, expense: done.record, errors: [] };
  }
  return { ok: true, expense: next, errors: [] };
}

/** 現在の承認段の残り承認者ロール(次に承認すべきロール)を返す。 */
export function pendingApprovalRole(expense: Expense): string | null {
  if (!expense.approval || expense.approval.status !== "pending") return null;
  const def = routeByAmount(expense.amount, APPROVAL_TIERS);
  return def.steps[expense.approval.currentStep]?.approverRole ?? null;
}
