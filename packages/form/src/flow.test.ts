import { describe, it, expect } from "vitest";
import { initialSubmitFlow, reviewData, editAgain, startSubmitting, submitFailed, submitSucceeded, resetSubmitFlow, phaseIndex } from "./flow.js";
describe("input→confirm→complete flow", () => {
  it("transitions through phases holding data", () => {
    let s = initialSubmitFlow<{ name: string }>();
    expect(s.phase).toBe("input");
    s = reviewData(s, { name: "山田" });
    expect(s).toMatchObject({ phase: "confirm", data: { name: "山田" } });
    expect(editAgain(s)).toMatchObject({ phase: "input", data: { name: "山田" } });
    s = startSubmitting(s);
    expect(s.submitting).toBe(true);
    expect(submitFailed(s, "err")).toMatchObject({ phase: "confirm", submitting: false, error: "err" });
    s = submitSucceeded(s);
    expect(s.phase).toBe("complete");
    expect(resetSubmitFlow().phase).toBe("input");
  });
  it("indexes phases", () => {
    expect([phaseIndex("input"), phaseIndex("confirm"), phaseIndex("complete")]).toEqual([0, 1, 2]);
  });
});
