import { describe, it, expect } from "vitest";
import { intervalsOverlap, countOverlapping, isSlotAvailable, availableSlots, remainingCapacity, hasConflict } from "./availability";
import { generateSlots } from "./slots";
const daySlots = generateSlots([{ open: "09:00", close: "12:00" }], { slotMinutes: 60 });
const bookings = [{ start: "09:00", end: "10:00" }, { start: "10:30", end: "11:30" }];
describe("booking availability", () => {
  it("computes overlaps and availability", () => {
    expect(intervalsOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
    expect(intervalsOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(countOverlapping({ start: "10:00", end: "11:00" }, bookings)).toBe(1);
    expect(isSlotAvailable({ start: "09:00", end: "10:00" }, bookings, 1)).toBe(false);
    expect(availableSlots(daySlots, bookings, 1)).toHaveLength(0);
    expect(availableSlots(daySlots, bookings, 2)).toHaveLength(3);
    expect(remainingCapacity(daySlots, bookings, 2)[0]!.remaining).toBe(1);
    expect(hasConflict({ start: "09:00", end: "10:00" }, bookings, 1)).toBe(true);
    expect(hasConflict({ start: "09:00", end: "10:00" }, bookings, 2)).toBe(false);
  });
});
