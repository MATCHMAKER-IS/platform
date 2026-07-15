import { describe, it, expect } from "vitest";
import { reminderSchedule, reminderKey, dueReminders, reminderTiming, reminderMessage } from "./reminders.js";
const bookingAt = "2025-07-26T18:00:00Z";
describe("booking reminders", () => {
  it("schedules and finds due", () => {
    const rules = [{ beforeMinutes: 1440, channel: "email" as const }, { beforeMinutes: 60, channel: "sms" as const }];
    const sched = reminderSchedule(bookingAt, rules);
    expect(sched[0]!.fireAt).toBe("2025-07-25T18:00:00.000Z");
    expect(sched[1]!.fireAt).toBe("2025-07-26T17:00:00.000Z");
    expect(reminderKey("bk1", { channel: "email", beforeMinutes: 1440 })).toBe("bk1:email:1440");
    const now1 = new Date("2025-07-25T18:30:00Z");
    expect(dueReminders("bk1", sched, now1)).toHaveLength(1);
    expect(dueReminders("bk1", sched, now1, { sentKeys: ["bk1:email:1440"] })).toHaveLength(0);
    const now2 = new Date("2025-07-26T17:30:00Z");
    expect(dueReminders("bk1", sched, now2)).toHaveLength(2);
    expect(dueReminders("bk1", sched, now2, { graceMinutes: 60 })).toHaveLength(1);
  });
  it("builds timing and messages", () => {
    expect(reminderTiming(1440)).toBe("day_before");
    expect(reminderTiming(60)).toBe("soon");
    expect(reminderMessage({ customerName: "山田", bookingAt, beforeMinutes: 1440, place: "新宿店" })).toContain("明日");
    expect(reminderMessage({ bookingAt, beforeMinutes: 60 })).toContain("まもなく");
  });
});
