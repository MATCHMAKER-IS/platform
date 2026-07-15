import { describe, it, expect, vi, afterEach } from "vitest";
import { createLineClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("line", () => {
  it("pushText は push エンドポイントに Bearer で POST する", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) });
    globalThis.fetch = f as unknown as typeof fetch;
    const line = createLineClient({ channelAccessToken: "tok" });
    const res = await line.pushText("U1", "hi");
    expect(res.ok).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/message/push");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });
});
