import { describe, it, expect } from "vitest";
import { startParallel, recordParallelApproval, isParallelComplete, remainingApprovers } from "./parallel";
describe("parallel approval", () => {
  const step = { name: "合議", approverRoles: ["legal", "finance", "hr"], mode: "all" as const };
  // **1 人 1 票。** 3 ロール必要なら**3 人**要る(兼務者が一度に埋められない)。
  // 2026-08 にそう決めたが、このテストだけ「u2 が finance と hr を同時に埋める」
  // 前提のまま残っていた(下の「並列承認は 1 人 1 票」が正)。
  it("completes when all roles approve", () => {
    let s = startParallel();
    s = recordParallelApproval(step, s, { id: "u1", roles: ["legal"] });
    expect(isParallelComplete(step, s)).toBe(false);
    expect(remainingApprovers(step, s).sort()).toEqual(["finance", "hr"]);
    s = recordParallelApproval(step, s, { id: "u2", roles: ["finance", "hr"] });
    // **兼務者でも 1 票。** まだ 1 ロール残る
    expect(isParallelComplete(step, s)).toBe(false);
    expect(remainingApprovers(step, s)).toEqual(["hr"]);
    s = recordParallelApproval(step, s, { id: "u3", roles: ["hr"] });
    expect(isParallelComplete(step, s)).toBe(true);
    expect(s.approvedBy).toHaveLength(3);
  });
  it("any-mode completes with one", () => {
    const any = { name: "x", approverRoles: ["a", "b"], mode: "any" as const };
    expect(isParallelComplete(any, recordParallelApproval(any, startParallel(), { id: "x", roles: ["b"] }))).toBe(true);
  });
});

describe("並列承認は 1 人 1 票", () => {
  const step = { name: "s", approverRoles: ["経理", "法務"], mode: "all" as const };

  // **兼務は中小企業では普通。** 複数ロールを持つ人が一度に全部埋められると、
  // 「全部署の承認が要る」という設計意図が成立しない(2026-08 に修正)
  it("兼務者 1 人では all を満たせない", () => {
    let st = startParallel();
    st = recordParallelApproval(step, st, { id: "u1", roles: ["経理", "法務"] });
    expect(st.approvedRoles).toHaveLength(1);
    expect(isParallelComplete(step, st)).toBe(false);
  });
  // **同じ人の 2 回目は数えない**
  it("同じ人が二度承認しても増えない", () => {
    let st = startParallel();
    st = recordParallelApproval(step, st, { id: "u1", roles: ["経理", "法務"] });
    st = recordParallelApproval(step, st, { id: "u1", roles: ["経理", "法務"] });
    expect(st.approvedRoles).toHaveLength(1);
  });
  // **別の人が承認すれば完了する**
  it("別人が承認すれば完了する", () => {
    let st = startParallel();
    st = recordParallelApproval(step, st, { id: "u1", roles: ["経理", "法務"] });
    st = recordParallelApproval(step, st, { id: "u2", roles: ["法務"] });
    expect(isParallelComplete(step, st)).toBe(true);
  });
});
