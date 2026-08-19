import { describe, it, expect } from "vitest";
import { can, transition, availableEvents, isFinal, run, createStateMachine, type StateMachineDefinition, validateMachine } from "./index";

type S = "pending" | "packed" | "shipped" | "delivered" | "cancelled";
type E = "pack" | "ship" | "deliver" | "cancel";
const def: StateMachineDefinition<S, E> = {
  initial: "pending",
  transitions: { pending: { pack: "packed", cancel: "cancelled" }, packed: { ship: "shipped", cancel: "cancelled" }, shipped: { deliver: "delivered" }, delivered: {}, cancelled: {} },
  final: ["delivered", "cancelled"],
};

describe("fsm", () => {
  it("can/transition", () => { expect(can(def, "pending", "pack")).toBe(true); expect(transition(def, "pending", "ship")).toBeNull(); });
  it("availableEvents/isFinal", () => { expect(availableEvents(def, "pending").sort()).toEqual(["cancel", "pack"]); expect(isFinal(def, "delivered")).toBe(true); });
  it("run", () => { expect(run(def, ["pack", "ship", "deliver"]).state).toBe("delivered"); expect(run(def, ["pack", "deliver"]).rejected).toBe("deliver"); });
  it("machine instance", () => { const m = createStateMachine(def); expect(m.send("pack")).toBe(true); expect(m.send("deliver")).toBe(false); m.send("ship"); m.send("deliver"); expect(m.isFinal()).toBe(true); });
});

describe("遷移表そのものの誤りを見つける", () => {
  // **型では防げない。** 遷移表は文字列のマップなので書き間違えても TypeScript は通り、
  // **実際に業務が止まってから気づく**(2026-08 に追加)
  it("正しい定義には何も出ない", () => {
    const def = { initial: "draft", transitions: { draft: { submit: "review" }, review: { approve: "done" }, done: {} }, final: ["done"] } as const;
    expect(validateMachine(def)).toEqual([]);
  });
  // **到達できない状態** — 「キャンセル済み」を作ったのにキャンセルできる画面が無い形
  it("どこからも来ない状態を見つける", () => {
    const def = { initial: "draft", transitions: { draft: { submit: "review" }, review: {}, orphan: { x: "draft" } }, final: ["review"] } as const;
    const p = validateMachine(def);
    expect(p.map((x) => x.kind)).toContain("unreachable");
    expect(p[0]?.state).toBe("orphan");
  });
  // **出られない状態** — 「承認待ち」で止まり業務が進まなくなる。最も見つけにくい
  it("final でないのに出る道が無い状態を見つける", () => {
    const def = { initial: "draft", transitions: { draft: { submit: "review" }, review: {} } } as const;
    expect(validateMachine(def).map((x) => x.kind)).toContain("dead-end");
  });
  // **遷移先が定義に無い** — 実行時に未定義の状態になる
  it("存在しない状態への遷移を見つける", () => {
    const def = { initial: "draft", transitions: { draft: { submit: "typo" } }, final: ["draft"] } as const;
    expect(validateMachine(def).map((x) => x.kind)).toContain("unknown-target");
  });
});
