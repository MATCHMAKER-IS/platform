/**
 * 経費申請のブループリント定義 + アクション実行の結線例。
 * ブループリントで手順を強制し、成功時のアクション(通知・仕訳起票)を副作用として実行する。
 * @packageDocumentation
 */
import { applyTransition, availableTransitions, type Blueprint } from "@platform/blueprint";
import { expenseJournal } from "@platform/accounting";

/** 経費レコード。 */
export interface Expense extends Record<string, unknown> {
  state: "draft" | "submitted" | "approved" | "rejected" | "paid";
  amount?: number;
  purpose?: string;
  taxNet?: number;
  tax?: number;
}

/** 経費精算のブループリント(提出→承認→支払、差戻し/却下つき)。 */
export const expenseBlueprint: Blueprint<Expense["state"], Expense> = {
  initial: "draft",
  states: ["draft", "submitted", "approved", "rejected", "paid"],
  final: ["rejected", "paid"],
  transitions: [
    { from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["notifyApprover"] },
    { from: "submitted", to: "approved", name: "承認", condition: (e) => (e.amount ?? 0) <= 100000, actions: ["postJournal"], allowedRoles: ["manager"] },
    { from: "submitted", to: "draft", name: "差戻し", allowedRoles: ["manager"] },
    { from: "submitted", to: "rejected", name: "却下", allowedRoles: ["manager"] },
    { from: "approved", to: "paid", name: "支払", actions: ["postPayment"], allowedRoles: ["accountant"] },
  ],
};

/** 遷移を実行し、発生したアクションを処理する(通知・仕訳起票などの副作用)。 */
export function runTransition(expense: Expense, transitionName: string, roles: string[]) {
  const result = applyTransition(expenseBlueprint, expense, transitionName, { roles });
  if (!result.ok) return { ok: false as const, errors: result.errors, expense };

  const effects: string[] = [];
  for (const action of result.actions) {
    if (action === "notifyApprover") effects.push("承認者へ通知しました");
    else if (action === "postJournal") {
      // 承認時に経費仕訳を自動起票
      const entry = expenseJournal({ date: new Date().toISOString().slice(0, 10), net: expense.taxNet ?? expense.amount ?? 0, tax: expense.tax ?? 0, account: "旅費交通費" });
      effects.push(`仕訳を起票しました(借方 ${entry.lines[0]?.account} ${entry.lines[0]?.debit})`);
    } else if (action === "postPayment") effects.push("支払仕訳を起票しました");
  }
  return { ok: true as const, expense: result.record, actions: result.actions, effects };
}

/** 現在の状態で選べるアクション名。 */
export function nextActions(expense: Expense): string[] {
  return availableTransitions(expenseBlueprint, expense.state, expense).map((t) => t.name);
}
