import { describe, it, expect } from "vitest";
import { isWithinShift, staffSlots, staffAvailableSlots, shiftMinutes, slotStaffing, availableWithStaffing } from "./shift";
import { generateSlots } from "./slots";
const slots = generateSlots([{ open: "09:00", close: "18:00" }], { slotMinutes: 60 });
describe("booking shift", () => {
  it("computes single-staff availability", () => {
    const shift = [{ start: "10:00", end: "14:00" }];
    expect(isWithinShift({ start: "10:00", end: "11:00" }, shift)).toBe(true);
    expect(isWithinShift({ start: "13:30", end: "14:30" }, shift)).toBe(false);
    expect(staffSlots(slots, shift).map((s) => s.start)).toEqual(["10:00", "11:00", "12:00", "13:00"]);
    expect(shiftMinutes(shift)).toBe(240);
    expect(staffAvailableSlots(slots, shift, [{ start: "11:00", end: "12:00" }]).map((s) => s.start)).toEqual(["10:00", "12:00", "13:00"]);
  });
  it("computes dynamic staffing", () => {
    const staffShifts = { aoi: [{ start: "10:00", end: "14:00" }], kaede: [{ start: "12:00", end: "18:00" }], minato: [{ start: "09:00", end: "12:00" }] };
    const staffing = slotStaffing(slots, staffShifts);
    expect(staffing.find((x) => x.slot.start === "09:00")!.staffCount).toBe(1);
    expect(staffing.find((x) => x.slot.start === "12:00")!.staffCount).toBe(2);
    const avail = availableWithStaffing(slots, staffShifts, [{ start: "12:00", end: "13:00" }, { start: "12:00", end: "13:00" }]);
    expect(avail.some((x) => x.slot.start === "12:00")).toBe(false);
    expect(avail.find((x) => x.slot.start === "13:00")!.remaining).toBe(2);
  });
});
