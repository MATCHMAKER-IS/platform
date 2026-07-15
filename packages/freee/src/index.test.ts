import { describe, it, expect, vi, afterEach } from "vitest";
import { createFreeeClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("freee", () => {
  it("getDeals は company_id を付けて Bearer で GET する", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ deals: [] }) });
    globalThis.fetch = f as unknown as typeof fetch;
    const freee = createFreeeClient({ accessToken: "tok" });
    const res = await freee.getDeals(123, { limit: 10 });
    expect(res.ok).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/deals?");
    expect(String(url)).toContain("company_id=123");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });
});
