"use client";
/**
 * ブループリントの操作画面。現在の状態と、実行できるアクションを BlueprintActions で出し分ける。
 * 必須項目が埋まっていない遷移はボタンを無効化し、理由を表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { BlueprintActions, Card, Input } from "@platform/ui";
import { availableTransitions, missingRequiredFields } from "@platform/blueprint";
import { expenseBlueprint, runTransition, type Expense } from "./expense-blueprint.js";

const STATE_STYLES = {
  draft: { label: "下書き", tone: "default" as const },
  submitted: { label: "申請中", tone: "info" as const },
  approved: { label: "承認済み", tone: "success" as const },
  rejected: { label: "却下", tone: "danger" as const },
  paid: { label: "支払済み", tone: "success" as const },
};

/** 経費申請のブループリント操作画面。 */
export function ExpenseBlueprintScreen() {
  const [expense, setExpense] = React.useState<Expense>({ state: "draft", amount: undefined, purpose: "" });
  const [log, setLog] = React.useState<string[]>([]);

  // 実行できるアクション(必須項目不足は無効化して理由表示)
  const actions = availableTransitions(expenseBlueprint, expense.state, expense).map((t) => {
    const missing = missingRequiredFields(t, expense);
    return { name: t.name, disabled: missing.length > 0, reason: missing.length > 0 ? `未入力: ${missing.map(String).join(", ")}` : undefined, danger: t.name === "却下" };
  });

  function onAction(name: string) {
    const result = runTransition(expense, name, ["manager", "accountant"]);
    if (!result.ok) { setLog((l) => [`✗ ${name}: ${result.errors.join(" / ")}`, ...l]); return; }
    setExpense(result.expense);
    setLog((l) => [`✓ ${name} → ${result.expense.state}${result.effects.length ? "(" + result.effects.join(" / ") + ")" : ""}`, ...l]);
  }

  const isFinal = expense.state === "rejected" || expense.state === "paid";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">経費申請</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">金額
            <Input type="number" value={expense.amount ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpense((x) => ({ ...x, amount: e.target.value ? Number(e.target.value) : undefined }))} />
          </label>
          <label className="flex flex-col gap-1 text-sm">目的
            <Input value={expense.purpose ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpense((x) => ({ ...x, purpose: e.target.value }))} />
          </label>
        </div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <BlueprintActions state={expense.state} stateStyles={STATE_STYLES} actions={actions} onAction={onAction} isFinal={isFinal} />
        </div>
      </Card>

      {log.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-muted)]">履歴</h3>
          <ul className="flex flex-col gap-1 text-sm">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
