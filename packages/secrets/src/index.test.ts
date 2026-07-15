import { describe, it, expect } from "vitest";
import { createSecretStore, createEnvProvider, createChainProvider, createFetchProvider } from "./index.js";
describe("secrets", () => {
  it("caches with TTL, require throws, chain falls back", async () => {
    let clk = 0; let fetches = 0;
    const store = createSecretStore({ get: async (n) => { fetches++; return n === "K" ? "v" : null; } }, { ttlMs: 1000, now: () => clk });
    expect(await store.get("K")).toBe("v");
    await store.get("K");
    expect(fetches).toBe(1);
    clk = 1001; await store.get("K");
    expect(fetches).toBe(2);
    await expect(store.require("MISSING")).rejects.toThrow();
    const chain = createChainProvider([createEnvProvider({}), createFetchProvider(async () => "vault")]);
    expect(await chain.get("x")).toBe("vault");
  });
});
