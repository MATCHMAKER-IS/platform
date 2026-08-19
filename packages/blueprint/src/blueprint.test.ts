import { describe, it, expect } from "vitest";
import { toStateMachine, validateBlueprint, missingRequiredFields, availableTransitions, evaluateTransition, applyTransition, isFinalState, transitionNames, type Blueprint } from "./blueprint";
interface Expense extends Record<string, unknown> { state: string; amount?: number; purpose?: string; }
const bp: Blueprint<"draft" | "submitted" | "approved" | "rejected", Expense> = {
  initial: "draft",
  states: ["draft", "submitted", "approved", "rejected"],
  final: ["approved", "rejected"],
  transitions: [
    { from: "draft", to: "submitted", name: "提出", requiredFields: ["amount", "purpose"], actions: ["notifyApprover"] },
    { from: "submitted", to: "approved", name: "承認", condition: (r) => (r.amount ?? 0) <= 100000, actions: ["createJournal"], allowedRoles: ["manager"] },
    { from: "submitted", to: "rejected", name: "却下", allowedRoles: ["manager"] },
  ],
};
describe("blueprint", () => {
  it("derives machine and enforces required fields", () => {
    expect(toStateMachine(bp).transitions.draft!["提出"]).toBe("submitted");
    expect(missingRequiredFields(bp.transitions[0]!, { state: "draft" })).toEqual(["amount", "purpose"]);
    expect(availableTransitions(bp, "draft", { state: "draft", amount: 1, purpose: "x" }).map((t) => t.name)).toEqual(["提出"]);
    expect(availableTransitions(bp, "submitted", { state: "submitted", amount: 200000 }).some((t) => t.name === "承認")).toBe(false);
  });
  it("evaluates and applies transitions with roles", () => {
    expect(evaluateTransition(bp, "draft", "提出", { state: "draft" }).ok).toBe(false);
    const good = evaluateTransition(bp, "draft", "提出", { state: "draft", amount: 5000, purpose: "x" });
    expect(good.ok).toBe(true);
    expect(good.nextState).toBe("submitted");
    expect(good.actions).toContain("notifyApprover");
    expect(evaluateTransition(bp, "submitted", "承認", { state: "submitted", amount: 5000 }, ["staff"]).ok).toBe(false);
    expect(evaluateTransition(bp, "submitted", "承認", { state: "submitted", amount: 5000 }, ["manager"]).ok).toBe(true);
    const applied = applyTransition(bp, { state: "draft", amount: 5000, purpose: "x" }, "提出");
    expect(applied.ok).toBe(true);
    expect(applied.record.state).toBe("submitted");
    expect(applyTransition(bp, { state: "draft" }, "提出").record.state).toBe("draft");
    expect(isFinalState(bp, "approved")).toBe(true);
    expect(transitionNames(bp, "submitted").sort()).toEqual(["却下", "承認"]);
  });
});

describe("業務フローの定義そのものを見る", () => {
  const base = { initial: "draft", states: ["draft", "submitted", "paid"], final: ["paid"] } as const;
  const T = [
    { from: "draft", to: "submitted", name: "提出" },
    { from: "submitted", to: "paid", name: "支払" },
  ];

  // **`validateMachine`(fsm)では足りない。** `toStateMachine` は `from` をキーに
  // 組み替えるので、**`from` に一度も現れない状態がキーから消える**
  // ——`states` に書いたのにどこからも遷移しない状態を見落とす(2026-08 に追加)
  it("正しい定義には何も出ない", () => {
    expect(validateBlueprint({ ...base, transitions: T } as never)).toEqual([]);
  });
  // **状態を足したのに、そこへ行く遷移を作り忘れた形**
  it("どこからも来ない状態を見つける", () => {
    const bp = { ...base, states: [...base.states, "orphan"], transitions: T };
    expect(validateBlueprint(bp as never).map((x) => x.kind)).toContain("unreachable");
  });
  // **「承認待ち」で止まり業務が進まなくなる形**
  it("final でないのに出る遷移が無い状態を見つける", () => {
    const bp = { ...base, final: [], transitions: T };
    expect(validateBlueprint(bp as never).map((x) => x.kind)).toContain("dead-end");
  });
  // **遷移が定義外の状態を指している**(綴り間違い)
  it("states に無い状態への遷移を見つける", () => {
    const bp = { ...base, transitions: [{ from: "draft", to: "typo", name: "提出" }] };
    expect(validateBlueprint(bp as never).map((x) => x.kind)).toContain("unknown-state");
  });
});
