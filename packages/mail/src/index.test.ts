import { describe, it, expect } from "vitest";
import { createMailer, createMemoryTransport } from "./index";

describe("mail", () => {
  it("既定 from を補い、Transport に送る", async () => {
    const mem = createMemoryTransport();
    const mailer = createMailer({ transport: mem, defaultFrom: "no-reply@example.co.jp" });
    const res = await mailer.sendMail({ to: "a@example.co.jp", subject: "件名", text: "本文" });
    expect(res.ok).toBe(true);
    expect(mem.sent[0]?.from).toBe("no-reply@example.co.jp");
    expect(mem.sent[0]?.to).toBe("a@example.co.jp");
  });

  it("Transport が投げたら EXTERNAL エラーを返す(例外は漏らさない)", async () => {
    const failing = {
      async send() {
        throw new Error("smtp down");
      },
    };
    const mailer = createMailer({ transport: failing, defaultFrom: "x@example.co.jp" });
    const res = await mailer.sendMail({ to: "a@example.co.jp", subject: "s" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXTERNAL");
  });
});
