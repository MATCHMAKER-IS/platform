import { describe, it, expect } from "vitest";
import { submitOvertime, statusLabel, availableActions, actOn, overtimeWorkflow } from "./overtime-approval.js";
import type { Actor } from "@platform/workflow";

const mgr: Actor = { id: "m1", roles: ["manager"] };
const dir: Actor = { id: "d1", roles: ["director"] };

describe("overtime approval", () => {
  it("threshold decides steps", () => { expect(overtimeWorkflow(180).steps).toHaveLength(1); expect(overtimeWorkflow(181).steps).toHaveLength(2); });
  it("short = single approval", () => { let r = submitOvertime("o1", "t", "2024-05-10", 120, "x"); r = actOn(r, mgr, "approve").request; expect(statusLabel(r)).toBe("承認済み"); });
  it("long = two-step", () => {
    let r = submitOvertime("o2", "t", "2024-05-11", 240, "x");
    r = actOn(r, mgr, "approve").request;
    expect(statusLabel(r)).toBe("部長承認");
    expect(availableActions(r, dir)).toContain("sendback");
    r = actOn(r, dir, "approve").request;
    expect(statusLabel(r)).toBe("承認済み");
  });
});
