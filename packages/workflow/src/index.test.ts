import { describe, it, expect } from "vitest";
import { startWorkflow, approve, reject, currentStep , sendBack} from "./index";

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
  // **前に進める指定は拒む**(差戻しなので)
  it("rejects invalid target step", () => {
    const mgr = { id: "m1", roles: ["manager"] };
    const st = startWorkflow(def);
    expect(sendBack(def, st, mgr, { toStep: 1 }).ok).toBe(false);
    expect(sendBack(def, st, mgr, { toStep: -1 }).ok).toBe(false);
  });
  // **最初のステップからでも差し戻せる**(申請者に戻して出し直してもらう)。
  // 1 段階しかないワークフローでは、これができないと差し戻す手段が無くなる
  it("最初のステップからでも差し戻せる", () => {
    const mgr = { id: "m1", roles: ["manager"] };
    const st = startWorkflow(def);
    const r = sendBack(def, st, mgr, { reason: "添付が足りません" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.status).toBe("pending"); expect(r.value.currentStep).toBe(0); }
  });
  // **差戻しは自己承認の禁止から外す**(自分の申請を自分で取り下げるのは正当)
  it("申請者本人でも差し戻せる", () => {
    const st = startWorkflow(def, "u1");
    expect(sendBack(def, st, { id: "u1", roles: ["manager"] }, { reason: "取り下げ" }).ok).toBe(true);
  });
});

describe("自己承認を防ぐ(職務分掌)", () => {
  const DEF = { steps: [{ name: "上長承認", approverRole: "manager" }] };
  const manager = { id: "u1", roles: ["manager"] };

  // **承認者ロールを持つ人は多くの場合管理職。**
  // 自分の経費を自分で承認できると内部統制が成立せず、監査で指摘される
  it("申請者本人は承認できない", () => {
    const state = startWorkflow(DEF, "u1");
    const r = approve(DEF, state, manager);
    expect(r.ok).toBe(false);
  });
  it("申請者本人は却下もできない", () => {
    const state = startWorkflow(DEF, "u1");
    expect(reject(DEF, state, manager, "却下").ok).toBe(false);
  });
  // **他人の申請は従来どおり通る**
  it("別人なら承認できる", () => {
    const state = startWorkflow(DEF, "u2");
    expect(approve(DEF, state, manager).ok).toBe(true);
  });
  // **既存データ(申請者なし)は通す。** ここで落とすと過去の申請が承認不能になる
  it("申請者が記録されていなければ判定しない", () => {
    const state = startWorkflow(DEF);
    expect(approve(DEF, state, manager).ok).toBe(true);
  });
});
