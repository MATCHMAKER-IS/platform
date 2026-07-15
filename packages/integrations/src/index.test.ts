import { describe, it, expect, vi, afterEach } from "vitest";
import { createApiClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body: unknown, ct = "application/json") {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    headers: { get: () => ct },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("integrations api client", () => {
  it("GET 成功時に型付きで値を返す", async () => {
    globalThis.fetch = mockFetchOnce(200, [{ id: 1 }]) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://api.example.com/v1" });
    const res = await api.get<{ id: number }[]>("/users");
    expect(res.ok && res.value).toEqual([{ id: 1 }]);
  });

  it("4xx は EXTERNAL エラー(リトライしない)", async () => {
    const f = mockFetchOnce(400, { error: "bad" });
    globalThis.fetch = f as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://api.example.com/v1", retries: 2 });
    const res = await api.get("/x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXTERNAL");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("5xx はリトライする", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: { get: () => "" }, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ ok: true }) });
    globalThis.fetch = f as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://api.example.com/v1", retries: 2 });
    const res = await api.get("/x");
    expect(res.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
