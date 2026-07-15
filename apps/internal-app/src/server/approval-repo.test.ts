import { describe, it, expect } from "vitest";
import { stateToRow, rowToState } from "./approval-repo.js";
import type { WorkflowState } from "@platform/workflow";

const state: WorkflowState = { status: "pending", currentStep: 1, history: [{ step: "課長承認", action: "approve", actor: "m1", at: "2024-05-01T00:00:00Z" }] };

describe("approval persistence mapping", () => {
  it("stateToRow", () => { const r = stateToRow(state); expect(r).toEqual({ status: "pending", currentStep: 1, history: state.history }); });
  it("round-trip", () => { const b = rowToState(stateToRow(state)); expect(b.status).toBe("pending"); expect(b.currentStep).toBe(1); expect(b.history[0]!.action).toBe("approve"); });
  it("strict status", () => { expect(rowToState({ status: "weird", currentStep: 0, history: [] }).status).toBe("pending"); expect(rowToState({ status: "approved", currentStep: 2, history: [] }).status).toBe("approved"); });
  it("non-array history -> []", () => expect(rowToState({ status: "pending", currentStep: 0, history: null }).history).toEqual([]));
});
