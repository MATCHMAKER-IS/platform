import { describe, it, expect } from "vitest";
import { toStateMachine, missingRequiredFields, availableTransitions, evaluateTransition, applyTransition, isFinalState, transitionNames, type Blueprint } from "./blueprint";
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
