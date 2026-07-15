import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, contrastRatio, wcagLevel, lighten, darken, mix, readableTextColor } from "./index.js";

describe("color", () => {
  it("hex <-> rgb", () => { expect(hexToRgb("#3366ff")).toEqual({ r: 51, g: 102, b: 255 }); expect(hexToRgb("#36f")).toEqual({ r: 51, g: 102, b: 255 }); expect(rgbToHex({ r: 51, g: 102, b: 255 })).toBe("#3366ff"); expect(hexToRgb("xyz")).toBeNull(); });
  it("rgb <-> hsl", () => { expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 }); const rt = hslToRgb(rgbToHsl({ r: 51, g: 102, b: 255 })); expect(Math.abs(rt.r - 51)).toBeLessThanOrEqual(2); });
  it("contrast + wcag", () => { expect(contrastRatio("#ffffff", "#000000")).toBe(21); expect(wcagLevel(21)).toBe("AAA"); expect(wcagLevel(3)).toBe("fail"); expect(wcagLevel(3, true)).toBe("AA"); });
  it("lighten/darken/mix/readable", () => { expect(lighten("#ffffff", 0.5)).toBe("#ffffff"); expect(mix("#ff0000", "#0000ff", 0.5)).toBe("#800080"); expect(readableTextColor("#ffff00")).toBe("#000000"); expect(rgbToHsl(hexToRgb(darken("#3366ff", 0.2))!).l).toBeLessThan(rgbToHsl(hexToRgb("#3366ff")!).l); });
});
