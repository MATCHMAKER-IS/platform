import { describe, it, expect } from "vitest";
import { createZohoCliqClient } from "./index";
describe("zoho cliq", () => {
  it("post to channel + bot", async () => {
    let cap: { url: string; body?: { text?: string } } | null = null;
    const fetchImpl = (async (url: string, init: { body?: string }) => { cap = { url, body: init.body ? JSON.parse(init.body) : undefined }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const c = createZohoCliqClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await c.postToChannel("CH1", "hi");
    expect(cap!.url).toBe("https://cliq.zoho.com/api/v2/channels/CH1/message");
    expect(cap!.body!.text).toBe("hi");
    await c.postToBot("bot", "x");
    expect(cap!.url).toContain("/bots/bot/message");
  });
});
