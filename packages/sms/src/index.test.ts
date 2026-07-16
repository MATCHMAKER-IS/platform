import { describe, it, expect } from "vitest";
import { createSms, createMemoryTransport } from "./index";

describe("sms", () => {
  it("既定 from を補い、Transport に送る", async () => {
    const mem = createMemoryTransport();
    const sms = createSms({ transport: mem, defaultFrom: "+815012345678" });
    const res = await sms.sendSms({ to: "+819012345678", body: "コード: 1234" });
    expect(res.ok).toBe(true);
    expect(mem.sent[0]?.from).toBe("+815012345678");
    expect(mem.sent[0]?.to).toBe("+819012345678");
  });

  it("Transport が投げたら EXTERNAL エラーを返す", async () => {
    const failing = {
      async send() {
        throw new Error("twilio down");
      },
    };
    const sms = createSms({ transport: failing, defaultFrom: "+815012345678" });
    const res = await sms.sendSms({ to: "+819012345678", body: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXTERNAL");
  });
});
