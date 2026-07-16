import { describe, it, expect } from "vitest";
import { pendingSince, evaluateSla, escalationTarget, findStalledApprovals } from "./escalation";
const pending = (h: { step: string; action: string; actor: string; at: string }[] = []) => ({ status: "pending" as const, currentStep: 0, history: h });
const start = new Date("2025-07-25T09:00:00Z");
const policy = { remindAfterMin: 60, reminderIntervalMin: 60, escalateAfterMin: 240 };
describe("escalation / SLA", () => {
  it("derives pending-since and evaluates SLA", () => {
    expect(pendingSince(pending(), start).getTime()).toBe(start.getTime());
    expect(evaluateSla(start, new Date("2025-07-25T09:30:00Z"), policy).action).toBe("none");
    const remind = evaluateSla(start, new Date("2025-07-25T10:30:00Z"), policy);
    expect(remind.action).toBe("remind");
    expect(remind.dueReminderCount).toBe(1);
    expect(evaluateSla(start, new Date("2025-07-25T10:30:00Z"), policy, { remindersSent: 1 }).action).toBe("none");
    expect(evaluateSla(start, new Date("2025-07-25T14:00:00Z"), policy).action).toBe("escalate");
  });
  it("finds escalation target and stalled items", () => {
    const def = { steps: [{ name: "課長", approverRole: "manager" }, { name: "部長", approverRole: "director" }] };
    expect((escalationTarget(def, pending()) as { approverRole: string }).approverRole).toBe("director");
    expect(escalationTarget(def, { status: "pending", currentStep: 1, history: [] })).toBeNull();
    const items = [{ id: "a", state: pending(), startedAt: start }, { id: "d", state: pending(), startedAt: new Date("2025-07-25T05:00:00Z") }];
    const stalled = findStalledApprovals(items, new Date("2025-07-25T10:30:00Z"), policy);
    expect(stalled.map((s) => s.action).sort()).toEqual(["escalate", "remind"]);
  });
});
