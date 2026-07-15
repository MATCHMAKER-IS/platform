import { describe, it, expect } from "vitest";
import { createApiClient } from "./index.js";

describe("multipart", () => {
  it("builds FormData and drops content-type", async () => {
    let cap: { body?: unknown; headers?: Record<string, string> } | null = null;
    const fetchImpl = (async (_u: string, init: { body?: unknown; headers?: Record<string, string> }) => { cap = { body: init.body, headers: init.headers }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "https://x.jp", fetchImpl });
    await api.post("/upload", { multipart: { fields: { name: "doc" }, files: [{ field: "content", filename: "a.txt", data: new TextEncoder().encode("hi") }] } });
    expect(cap!.body instanceof FormData).toBe(true);
    expect("content-type" in cap!.headers!).toBe(false);
    expect((cap!.body as FormData).get("name")).toBe("doc");
  });
});
