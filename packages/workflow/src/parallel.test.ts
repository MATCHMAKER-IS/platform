import { describe, it, expect } from "vitest";
import { startParallel, recordParallelApproval, isParallelComplete, remainingApprovers } from "./parallel";
describe("parallel approval", () => {
  const step = { name: "合議", approverRoles: ["legal", "finance", "hr"], mode: "all" as const };
  it("completes when all roles approve", () => {
    let s = startParallel();
    s = recordParallelApproval(step, s, { id: "u1", roles: ["legal"] });
    expect(isParallelComplete(step, s)).toBe(false);
    expect(remainingApprovers(step, s).sort()).toEqual(["finance", "hr"]);
    s = recordParallelApproval(step, s, { id: "u2", roles: ["finance", "hr"] });
    expect(isParallelComplete(step, s)).toBe(true);
    expect(s.approvedBy).toHaveLength(3);
  });
  it("any-mode completes with one", () => {
    const any = { name: "x", approverRoles: ["a", "b"], mode: "any" as const };
    expect(isParallelComplete(any, recordParallelApproval(any, startParallel(), { id: "x", roles: ["b"] }))).toBe(true);
  });
});
