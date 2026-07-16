import { describe, it, expect } from "vitest";
import { withStorageRetry, createFallbackStorage } from "./resilient";
import type { StorageAdapter } from "./index";

function mk(name: string, fail: { putFail?: boolean; getFail?: boolean } = {}): StorageAdapter & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    put: async (k, b) => { if (fail.putFail) throw new Error(`${name} put`); store.set(k, b); },
    get: async (k) => { if (fail.getFail) throw new Error(`${name} get`); const v = store.get(k); if (!v) throw new Error("nf"); return v; },
    delete: async (k) => { store.delete(k); },
    exists: async (k) => store.has(k),
    list: async () => [...store.keys()],
  };
}

describe("storage resilience", () => {
  it("retries put then succeeds / exhausts", async () => {
    let n = 0;
    const flaky: StorageAdapter = { put: async () => { n++; if (n < 3) throw new Error("5xx"); }, get: async () => new Uint8Array(), delete: async () => {}, exists: async () => true, list: async () => [] };
    await withStorageRetry(flaky, { retries: 2, sleep: async () => {} }).put("k", new Uint8Array());
    expect(n).toBe(3);
  });
  it("read-through fallback to secondary", async () => {
    const primary = mk("p", { getFail: true }); const secondary = mk("s");
    secondary.store.set("d", new TextEncoder().encode("x"));
    const got = await createFallbackStorage([primary, secondary]).get("d");
    expect(new TextDecoder().decode(got)).toBe("x");
  });
  it("mirror writes to all", async () => {
    const p = mk("p"); const s = mk("s");
    await createFallbackStorage([p, s], { mirrorWrites: true }).put("k", new TextEncoder().encode("v"));
    expect(p.store.has("k")).toBe(true); expect(s.store.has("k")).toBe(true);
  });
});
