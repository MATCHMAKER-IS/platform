import { describe, it, expect } from "vitest";
import { createLineClient, lineRecipientType, isValidLineRecipient } from "./index";

describe("line client", () => {
  it("recipient type", () => { expect(lineRecipientType("U" + "a".repeat(32))).toBe("user"); expect(lineRecipientType("C" + "1".repeat(32))).toBe("group"); expect(isValidLineRecipient("x")).toBe(false); });
  it("pushText builds correct request", async () => {
    let cap: { url: string; init: { method?: string; headers?: Record<string, string>; body?: string } } | null = null;
    const fake = (async (url: string, init: unknown) => { cap = { url, init: init as never }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const client = createLineClient({ channelAccessToken: "TK", fetchImpl: fake });
    const res = await client.pushText("U" + "a".repeat(32), "hi");
    expect(res.ok).toBe(true);
    expect(cap!.url).toBe("https://api.line.me/v2/bot/message/push");
    expect(cap!.init.headers!.Authorization).toBe("Bearer TK");
    expect(JSON.parse(cap!.init.body!).messages[0].text).toBe("hi");
  });
});
