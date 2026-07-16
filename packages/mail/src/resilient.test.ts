import { describe, it, expect } from "vitest";
import { withMailRetry, createFallbackMailTransport } from "./resilient";
import type { MailTransport } from "./index";
const msg = { to: "a@x.jp", subject: "s", from: "f@x.jp" };
describe("mail resilience", () => {
  it("retry with shouldRetry", async () => {
    let n = 0;
    await withMailRetry({ send: async () => { n++; if (n < 2) throw new Error("busy"); } } as MailTransport, { retries: 1, sleep: async () => {} }).send(msg);
    expect(n).toBe(2);
    let m = 0;
    await expect(withMailRetry({ send: async () => { m++; throw new Error("550"); } } as MailTransport, { retries: 3, sleep: async () => {}, shouldRetry: (e) => !(e as Error).message.startsWith("5") }).send(msg)).rejects.toThrow();
    expect(m).toBe(1);
  });
  it("fallback SMTP to SES", async () => {
    let ses = 0;
    await createFallbackMailTransport([{ send: async () => { throw new Error("smtp"); } }, { send: async () => { ses++; } }]).send(msg);
    expect(ses).toBe(1);
  });
});
