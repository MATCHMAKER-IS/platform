import { describe, it, expect } from "vitest";
import { requireSession, requireRole, enforceRateLimit } from "./index";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit";

const fakeSession = <T,>(value: T | null) => ({ read: () => value, write: () => "", destroy: () => "" });

describe("guard", () => {
  it("requireSession: 無ければ UNAUTHORIZED", () => {
    expect(() => requireSession("", fakeSession<{ id: string }>(null))).toThrow();
    expect(requireSession("", fakeSession({ id: "u1" })).id).toBe("u1");
  });
  it("requireRole: ロール不足は FORBIDDEN", () => {
    expect(() => requireRole({ id: "u1", roles: ["user"] }, "admin")).toThrow();
    expect(() => requireRole({ id: "u1", roles: ["admin"] }, "admin")).not.toThrow();
  });
  it("enforceRateLimit: 上限超過で RATE_LIMITED", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 2, windowSeconds: 60 });
    await enforceRateLimit(limiter, "k");
    await enforceRateLimit(limiter, "k");
    await expect(enforceRateLimit(limiter, "k")).rejects.toThrow();
  });
});
