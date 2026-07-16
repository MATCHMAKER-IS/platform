import { describe, it, expect } from "vitest";
import { generateSlots, slotsForRange, slotDuration } from "./slots";
describe("booking slots", () => {
  it("generates slots", () => {
    const s = generateSlots([{ open: "09:00", close: "11:00" }], { slotMinutes: 30 });
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ start: "09:00", end: "09:30" });
    expect(generateSlots([{ open: "09:00", close: "10:00" }], { slotMinutes: 30, stepMinutes: 15 }).map((x) => x.start)).toEqual(["09:00", "09:15", "09:30"]);
    expect(generateSlots([{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }], { slotMinutes: 60 })).toHaveLength(8);
    expect(slotDuration({ start: "09:00", end: "10:30" })).toBe(90);
  });
});
