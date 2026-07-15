import { describe, it, expect } from "vitest";
import { isWithinBookingWindow, canCancel, validatePartySize, RULE_MESSAGES } from "./rules.js";
const now = new Date("2025-07-25T12:00:00Z");
describe("booking rules", () => {
  it("validates window, cancel, party size", () => {
    expect(isWithinBookingWindow("2025-07-26T12:00:00Z", { minLeadMinutes: 60, maxAdvanceDays: 30 }, now).ok).toBe(true);
    expect(isWithinBookingWindow("2025-07-24T12:00:00Z", {}, now).reason).toBe("past");
    expect(isWithinBookingWindow("2025-07-25T12:30:00Z", { minLeadMinutes: 60 }, now).reason).toBe("too_soon");
    expect(isWithinBookingWindow("2025-09-25T12:00:00Z", { maxAdvanceDays: 30 }, now).reason).toBe("too_far");
    expect(canCancel("2025-07-26T12:00:00Z", 1440, now)).toBe(true);
    expect(canCancel("2025-07-25T18:00:00Z", 1440, now)).toBe(false);
    expect(validatePartySize(0, { min: 1 }).reason).toBe("too_few");
    expect(validatePartySize(5, { max: 4 }).reason).toBe("too_many");
    expect(RULE_MESSAGES.past.length).toBeGreaterThan(0);
  });
});
