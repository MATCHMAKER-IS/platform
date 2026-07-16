import { describe, it, expect } from "vitest";
import { orientationFromDimensions, simplifyOrientationType } from "./orientation";
describe("orientation", () => {
  it("derives from dimensions and type", () => {
    expect(orientationFromDimensions(1024, 768)).toBe("landscape");
    expect(orientationFromDimensions(375, 812)).toBe("portrait");
    expect(simplifyOrientationType("landscape-primary")).toBe("landscape");
  });
});
