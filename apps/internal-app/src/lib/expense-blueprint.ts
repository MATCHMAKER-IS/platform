/**
 * 経費申請のブループリント定義(アプリ層)。基盤 @platform/blueprint で手順を宣言的に定義し、
 * 承認は @platform/workflow の金額ルーティングに委譲、承認完了時に @platform/accounting で仕訳起票。
 * @packageDocumentation
 */
import { applyTransition, availableTransitions, type Blueprint } from "@platform/blueprint";
import { routeByAmount, startWorkflow, approve, type AmountTier, type WorkflowState, type Actor } from "@platform/workflow";
import { expenseJournal, type JournalEntry } from "@platform/accounting";

/** 経費レコード。 */
export interface ExpenseRecord extends Record<string, unknown> {
  id: string;
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  amount: number;
  taxNet?: number;
  tax?: number;
  purpose?: string;
  category?: string;
  approval?: WorkflowState;
}

/** 金額帯ごとの承認段数。 */
export const EXPENSE_APPROVAL_TIERS: AmountTier[] = [
  { under: 30000, steps: [{ name: "課長承認", approverRole: "manager" }] },
  { under: 100000, steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }] },
  { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }, { name: "役員承認", approverRole: "executive" }] },
];

/** 経費精算のブループリント。 */
export const expenseBlueprint: Blueprint<ExpenseRecord["state"], ExpenseRecord> = {
  initial: "draft",
  states: ["draft", "submitted", "approved", "rejected", "paid"],
  final: ["rejected", "paid"],
  transitions: [
    { from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose", "category"], actions: ["startApproval"] },
    { from: "submitted", to: "approved", name: "承認完了", condition: (e) => e.approval?.status === "approved", actions: ["postJournal"] },
    { from: "submitted", to: "rejected", name: "却下", condition: (e) => e.approval?.status === "rejected" },
    { from: "submitted", to: "draft", name: "差戻し", allowedRoles: ["manager"] },
    { from: "approved", to: "paid", name: "支払", actions: ["postPayment"], allowedRoles: ["accountant"] },
  ],
};

/** 現在の状態で選べるアクション(UI の BlueprintActions に渡す形)。 */
export function expenseActions(expense: ExpenseRecord): { name: string; disabled?: boolean }[] {
  return availableTransitions(expenseBlueprint, expense.state, expense).map((t) => ({ name: t.name }));
}

/** 提出 → 承認ワークフロー開始。 */
export function submitExpense(expense: ExpenseRecord): { ok: boolean; expense: ExpenseRecord; errors: string[] } {
  const t = applyTransition(expenseBlueprint, expense, "提出");
  if (!t.ok) return { ok: false, expense, errors: t.errors };
  const approval = startWorkflow(routeByAmount(expense.amount, EXPENSE_APPROVAL_TIERS));
  return { ok: true, expense: { ...t.record, approval }, errors: [] };
}

/** 承認ステップ。全段完了で仕訳を起票して返す。 */
export function approveExpense(expense: ExpenseRecord, actor: Actor): { ok: boolean; expense: ExpenseRecord; errors: string[]; journal?: JournalEntry } {
  if (!expense.approval) return { ok: false, expense, errors: ["承認が開始されていません"] };
  const result = approve(routeByAmount(expense.amount, EXPENSE_APPROVAL_TIERS), expense.approval, actor);
  if (!result.ok) return { ok: false, expense, errors: [result.error.message] };
  const next: ExpenseRecord = { ...expense, approval: result.value };
  if (result.value.status === "approved") {
    const done = applyTransition(expenseBlueprint, next, "承認完了");
    if (done.ok) {
      const journal = expenseJournal({ date: new Date().toISOString().slice(0, 10), net: next.taxNet ?? next.amount, tax: next.tax ?? 0, account: next.category });
      return { ok: true, expense: done.record, errors: [], journal };
    }
  }
  return { ok: true, expense: next, errors: [] };
}

import { record, type AuditEntry } from "./audit.js";

/** 提出 + 監査記録。 */
export function auditedSubmit(log: AuditEntry[], expense: ExpenseRecord, actor: string): { result: ReturnType<typeof submitExpense>; log: AuditEntry[] } {
  const before = { state: expense.state };
  const result = submitExpense(expense);
  const nextLog = result.ok
    ? record(log, { actor, action: "expense.submit", target: `expense:${expense.id}`, before, after: { state: result.expense.state } })
    : log;
  return { result, log: nextLog };
}

/** 承認 + 監査記録(承認完了で仕訳起票も記録)。 */
export function auditedApprove(log: AuditEntry[], expense: ExpenseRecord, actor: { id: string; roles: string[] }): { result: ReturnType<typeof approveExpense>; log: AuditEntry[] } {
  const before = { state: expense.state, status: expense.approval?.status };
  const result = approveExpense(expense, actor);
  let nextLog = log;
  if (result.ok) {
    nextLog = record(nextLog, { actor: actor.id, action: "expense.approve", target: `expense:${expense.id}`, before, after: { state: result.expense.state, status: result.expense.approval?.status } });
    if (result.journal) {
      nextLog = record(nextLog, { actor: actor.id, action: "expense.journal", target: `expense:${expense.id}`, meta: { lines: result.journal.lines.length } });
    }
  }
  return { result, log: nextLog };
}
