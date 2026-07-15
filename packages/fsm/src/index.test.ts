import { describe, it, expect } from "vitest";
import { can, transition, availableEvents, isFinal, run, createStateMachine, type StateMachineDefinition } from "./index.js";

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
