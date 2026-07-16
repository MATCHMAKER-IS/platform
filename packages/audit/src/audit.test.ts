import { describe, it, expect } from "vitest";
import { diffChanges, describeEvent } from "./event";
import { appendEvent, appendAll, verifyChain, fnv1a, type AuditEntry } from "./log";
import { filterByActor, filterByAction, filterByPeriod, historyOf } from "./query";
describe("audit", () => {
  it("diffs and describes", () => {
    expect(diffChanges({ status: "draft", amount: 5000 }, { status: "submitted", amount: 5000 })).toHaveLength(1);
    expect(describeEvent({ at: "x", actor: "u1", action: "a", target: "t" })).toContain("u1");
  });
  it("chains and detects tampering", () => {
    let log: AuditEntry[] = [];
    log = appendEvent(log, { at: "2025-07-01T10:00:00Z", actor: "u1", action: "expense.create", target: "expense:1" });
    log = appendEvent(log, { at: "2025-07-01T11:00:00Z", actor: "u1", action: "expense.submit", target: "expense:1", before: { status: "draft" }, after: { status: "submitted" } });
    log = appendEvent(log, { at: "2025-07-02T09:00:00Z", actor: "mgr", action: "expense.approve", target: "expense:1" });
    expect(log[1]!.prevHash).toBe(log[0]!.hash);
    expect(verifyChain(log).valid).toBe(true);
    expect(verifyChain(log.map((e, i) => (i === 1 ? { ...e, actor: "attacker" } : e))).brokenAt).toBe(1);
    expect(verifyChain([log[0]!, log[2]!]).valid).toBe(false);
    expect(appendAll([], [{ at: "x", actor: "u", action: "a", target: "t" }]).length).toBe(1);
  });
  it("queries", () => {
    let log: AuditEntry[] = [];
    log = appendEvent(log, { at: "2025-07-01T10:00:00Z", actor: "u1", action: "expense.create", target: "expense:1" });
    log = appendEvent(log, { at: "2025-07-02T09:00:00Z", actor: "mgr", action: "invoice.issue", target: "invoice:1" });
    expect(filterByActor(log, "u1")).toHaveLength(1);
    expect(filterByAction(log, "expense")).toHaveLength(1);
    expect(filterByPeriod(log, "2025-07-01", "2025-07-01")).toHaveLength(1);
    expect(historyOf(log, "expense:1")).toHaveLength(1);
    expect(fnv1a("test")).toMatch(/^[0-9a-f]{8}$/);
  });
});
