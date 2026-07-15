import { describe, it, expect } from "vitest";
import { canTransition, nextStatuses, isFinalStatus, isActiveBooking, BOOKING_STATUS_LABELS } from "./status.js";
describe("booking status", () => {
  it("manages lifecycle", () => {
    expect(canTransition("requested", "confirmed")).toBe(true);
    expect(canTransition("requested", "completed")).toBe(false);
    expect(nextStatuses("confirmed").sort()).toEqual(["cancelled", "completed", "no_show"]);
    expect(isFinalStatus("completed")).toBe(true);
    expect(isActiveBooking("confirmed")).toBe(true);
    expect(isActiveBooking("cancelled")).toBe(false);
    expect(BOOKING_STATUS_LABELS.no_show).toBe("無断キャンセル");
  });
});
