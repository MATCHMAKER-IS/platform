import { describe, it, expect } from "vitest";
import { canTransition, transition, isOverdue, daysUntilDue, summarize, sortTasks, filterTasks, toKanban, workloadByAssignee, type Task } from "./task";

const mk = (o: Partial<Task> & { id: string }): Task => ({
  title: "x", status: "todo", priority: "normal", createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z", ...o,
});
const today = new Date("2026-07-15T00:00:00Z");

describe("状態遷移", () => {
  it("順序を飛ばせない(着手せずに完了はできない)", () => {
    expect(canTransition("todo", "doing")).toBe(true);
    expect(canTransition("todo", "done")).toBe(false);
  });

  it("差し戻しと中止はできる", () => {
    expect(canTransition("done", "doing")).toBe(true);
    expect(canTransition("review", "canceled")).toBe(true);
  });

  it("不正な遷移はエラー", () => {
    expect(() => transition(mk({ id: "1" }), "done")).toThrow(/飛ばせません/);
  });

  it("正当な遷移は状態と updatedAt を更新する", () => {
    const t = transition(mk({ id: "1" }), "doing", new Date("2026-07-15T10:00:00Z"));
    expect(t.status).toBe("doing");
    expect(t.updatedAt).toBe("2026-07-15T10:00:00.000Z");
  });
});

describe("期限", () => {
  it("完了・中止したタスクは期限切れにしない", () => {
    expect(isOverdue(mk({ id: "1", dueDate: "2026-07-10" }), today)).toBe(true);
    expect(isOverdue(mk({ id: "1", dueDate: "2026-07-10", status: "done" }), today)).toBe(false);
    expect(isOverdue(mk({ id: "1" }), today)).toBe(false);
  });

  it("残日数を返す(過ぎていればマイナス)", () => {
    expect(daysUntilDue(mk({ id: "1", dueDate: "2026-07-20" }), today)).toBe(5);
    expect(daysUntilDue(mk({ id: "1", dueDate: "2026-07-10" }), today)).toBe(-5);
    expect(daysUntilDue(mk({ id: "1" }), today)).toBeUndefined();
  });
});

describe("集計", () => {
  const tasks = [
    mk({ id: "1", status: "done" }), mk({ id: "2", status: "done" }),
    mk({ id: "3", status: "doing", dueDate: "2026-07-10", estimateHours: 8, actualHours: 10 }),
    mk({ id: "4", status: "todo", estimateHours: 4 }),
    mk({ id: "5", status: "canceled" }),
  ];

  it("中止したタスクは進捗の分母から除く", () => {
    const s = summarize(tasks, today);
    expect(s.rate).toBeCloseTo(0.5); // 2 done / 4 (canceled を除く)
    expect(s.overdue).toBe(1);
    expect(s.estimateHours).toBe(12);
  });

  it("空でも壊れない", () => {
    expect(summarize([]).rate).toBe(0);
  });
});

describe("並べ替え・絞り込み", () => {
  it("優先度順に並ぶ", () => {
    const r = sortTasks([mk({ id: "a", priority: "low" }), mk({ id: "b", priority: "urgent" }), mk({ id: "c", priority: "high" })]);
    expect(r.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("期限順では期限なしが最後", () => {
    const r = sortTasks([mk({ id: "a" }), mk({ id: "b", dueDate: "2026-07-20" }), mk({ id: "c", dueDate: "2026-07-10" })], "dueDate");
    expect(r.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("サブタスクを除ける", () => {
    const r = filterTasks([mk({ id: "p" }), mk({ id: "s", parentId: "p" })], { topLevelOnly: true });
    expect(r).toHaveLength(1);
  });
});

describe("かんばん・負荷", () => {
  it("4 列に分ける(中止は出さない)", () => {
    const kb = toKanban([mk({ id: "1" }), mk({ id: "2", status: "canceled" })]);
    expect(kb.map((k) => k.status)).toEqual(["todo", "doing", "review", "done"]);
    expect(kb.flatMap((k) => k.tasks)).toHaveLength(1);
  });

  it("未完のタスクだけで負荷を測る", () => {
    const wl = workloadByAssignee([
      mk({ id: "1", assignee: "a", estimateHours: 8 }),
      mk({ id: "2", assignee: "a", status: "done", estimateHours: 100 }),
      mk({ id: "3" }),
    ]);
    expect(wl[0]?.assignee).toBe("a");
    expect(wl[0]?.hours).toBe(8);
    expect(wl.some((w) => w.assignee === "(未割り当て)")).toBe(true);
  });
});
