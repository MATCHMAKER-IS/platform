import { describe, it, expect } from "vitest";
import { createLoginAudit, summarizeLoginEvent } from "./login-audit";
describe("login audit", () => {
  it("records standardized events", async () => {
    const events: unknown[] = [];
    const audit = createLoginAudit({ record: (e) => { events.push(e); } }, { now: () => new Date("2025-07-25T12:00:00Z") });
    await audit.loginSuccess({ subject: "a@x.com", ip: "10.0.0.1", method: "password" });
    await audit.accountLocked({ subject: "a@x.com", reason: "too_many_attempts" });
    expect((events[0] as { event: string }).event).toBe("login_success");
    expect((events[0] as { at: string }).at).toBe("2025-07-25T12:00:00.000Z");
    expect((events[1] as { event: string }).event).toBe("account_locked");
  });
  it("summarizes without leaking metadata", () => {
    expect(summarizeLoginEvent({ event: "login_failure", subject: "a@x.com", ip: "1.2.3.4", reason: "bad", at: "2025-07-25T12:00:00Z" })).toContain("login_failure");
  });
});
