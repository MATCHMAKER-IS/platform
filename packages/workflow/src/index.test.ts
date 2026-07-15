import { describe, it, expect } from "vitest";
import { startWorkflow, approve, reject, currentStep , sendBack} from "./index.js";

const def = {
  steps: [
    { name: "課長承認", approverRole: "manager" },
    { name: "部長承認", approverRole: "director" },
  ],
};

describe("workflow", () => {
  it("多段承認を最後まで進めると approved になる", () => {
    let state = startWorkflow(def);
    expect(currentStep(def, state)?.name).toBe("課長承認");

    const r1 = approve(def, state, { id: "u1", roles: ["manager"] });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.value;
    expect(state.status).toBe("pending");
    expect(currentStep(def, state)?.name).toBe("部長承認");

    const r2 = approve(def, state, { id: "u2", roles: ["director"] });
    expect(r2.ok && r2.value.status).toBe("approved");
  });

  it("権限が無いと承認できない", () => {
    const state = startWorkflow(def);
    const r = approve(def, state, { id: "u1", roles: ["staff"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("却下すると rejected で終了する", () => {
    const state = startWorkflow(def);
    const r = reject(def, state, { id: "u1", roles: ["manager"] }, "金額超過");
    expect(r.ok && r.value.status).toBe("rejected");
    if (r.ok) expect(r.value.history[0]?.reason).toBe("金額超過");
  });

  it("完了済みは操作できない", () => {
    let state = startWorkflow({ steps: [{ name: "承認", approverRole: "manager" }] });
    const done = approve({ steps: [{ name: "承認", approverRole: "manager" }] }, state, { id: "u1", roles: ["manager"] });
    if (done.ok) state = done.value;
    const again = approve({ steps: [{ name: "承認", approverRole: "manager" }] }, state, { id: "u1", roles: ["manager"] });
    expect(again.ok).toBe(false);
  });
});

describe("sendBack (差戻し)", () => {
  const def = { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "部長承認", approverRole: "director" }] };
  it("returns to previous step keeping pending", () => {
    const mgr = { id: "m1", roles: ["manager"] }, dir = { id: "d1", roles: ["director"] };
    let st = startWorkflow(def);
    st = (approve(def, st, mgr) as { ok: true; value: typeof st }).value;
    const r = sendBack(def, st, dir, { reason: "確認" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.status).toBe("pending"); expect(r.value.currentStep).toBe(0); expect(r.value.history.at(-1)!.action).toBe("sendback"); }
  });
  it("rejects invalid target step", () => {
    const mgr = { id: "m1", roles: ["manager"] };
    const st = startWorkflow(def);
    expect(sendBack(def, st, mgr, { toStep: 0 }).ok).toBe(false);
  });
});
