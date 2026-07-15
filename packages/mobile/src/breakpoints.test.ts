import { describe, it, expect } from "vitest";
import { matchBreakpoint, deviceSizeFromWidth, isBreakpointUp } from "./breakpoints.js";
describe("breakpoints", () => {
  it("matches breakpoint by width", () => {
    expect(matchBreakpoint(375)).toBe("xs");
    expect(matchBreakpoint(640)).toBe("sm");
    expect(matchBreakpoint(800)).toBe("md");
    expect(matchBreakpoint(1400)).toBe("xl");
  });
  it("classifies device size and up-checks", () => {
    expect(deviceSizeFromWidth(375)).toBe("mobile");
    expect(deviceSizeFromWidth(800)).toBe("tablet");
    expect(deviceSizeFromWidth(1400)).toBe("desktop");
    expect(isBreakpointUp(1024, "lg")).toBe(true);
    expect(isBreakpointUp(900, "lg")).toBe(false);
  });
});
