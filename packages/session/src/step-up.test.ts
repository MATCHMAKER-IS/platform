import { describe, it, expect } from "vitest";
import { createStepUp, sessionMaxAge } from "./step-up";
describe("step-up + remember-me", () => {
  it("requires re-auth when stale", () => {
    let clock = 0; const step = createStepUp({ freshnessSec: 300, now: () => clock });
    expect(step.required(undefined)).toBe(true);
    const at = step.stamp();
    expect(step.required(at)).toBe(false);
    clock = 301_000;
    expect(step.required(at)).toBe(true);
  });
  it("remember-me picks longer max age", () => {
    expect(sessionMaxAge(false, { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 2592000 })).toBe(3600);
    expect(sessionMaxAge(true, { defaultMaxAgeSec: 3600, rememberMaxAgeSec: 2592000 })).toBe(2592000);
  });
});
