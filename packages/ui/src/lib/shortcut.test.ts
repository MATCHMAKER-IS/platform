import { describe, it, expect } from "vitest";
import { parseShortcut, matchShortcut, formatShortcut, isSequence, parseSequence, sequenceMatches } from "./shortcut.js";
describe("ui shortcut", () => {
  it("parses and matches (mod = meta on mac, ctrl on win)", () => {
    const k = parseShortcut("mod+k");
    expect(k.key).toBe("k");
    expect(k.mod).toBe(true);
    expect(matchShortcut({ key: "k", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }, k, true)).toBe(true);
    expect(matchShortcut({ key: "k", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, k, false)).toBe(true);
    expect(matchShortcut({ key: "j", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, k, false)).toBe(false);
  });
  it("formats for display", () => {
    const sh = parseShortcut("mod+shift+p");
    expect(formatShortcut(sh, true)).toContain("⌘");
    expect(formatShortcut(sh, false)).toContain("Ctrl");
  });
  it("handles sequences", () => {
    expect(isSequence("g h")).toBe(true);
    expect(isSequence("mod+k")).toBe(false);
    expect(parseSequence("g h")).toEqual(["g", "h"]);
    expect(sequenceMatches(["g", "h"], ["g", "h"])).toBe("complete");
    expect(sequenceMatches(["g"], ["g", "h"])).toBe("partial");
    expect(sequenceMatches(["x"], ["g", "h"])).toBe("none");
  });
});
