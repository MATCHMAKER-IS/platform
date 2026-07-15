import { describe, it, expect } from "vitest";
import { readingTime } from "./reading-time.js";
describe("reading time", () => {
  it("estimates cjk and words", () => {
    expect(readingTime("あ".repeat(1000)).minutes).toBe(2);
    expect(readingTime(Array(500).fill("word").join(" ")).minutes).toBe(2);
    expect(readingTime("短い").minutes).toBe(1);
    const r = readingTime("漢字 word test");
    expect(r.cjkChars).toBe(2);
    expect(r.words).toBe(2);
  });
});
