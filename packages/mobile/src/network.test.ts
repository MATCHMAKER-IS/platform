import { describe, it, expect } from "vitest";
import { classifyConnection, shouldSaveData } from "./network.js";
describe("network classification", () => {
  it("classifies by effectiveType/downlink/online", () => {
    expect(classifyConnection({ online: false })).toBe("offline");
    expect(classifyConnection({ effectiveType: "2g" })).toBe("slow");
    expect(classifyConnection({ effectiveType: "4g" })).toBe("fast");
    expect(classifyConnection({ downlink: 0.3 })).toBe("slow");
    expect(classifyConnection({})).toBe("unknown");
  });
  it("decides data-saving", () => {
    expect(shouldSaveData("slow")).toBe(true);
    expect(shouldSaveData("fast", true)).toBe(true);
    expect(shouldSaveData("fast")).toBe(false);
  });
});
