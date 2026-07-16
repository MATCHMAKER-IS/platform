import { describe, it, expect } from "vitest";
import { transactionWithRetry } from "./resilience";
import { abortTransaction } from "./transaction";
import type { PrismaClient } from "@prisma/client";
function makeDb(behavior: (fn: (tx: unknown) => Promise<unknown>, n: number) => Promise<unknown>) {
  let calls = 0; let lastOpts: { isolationLevel?: unknown; timeout?: unknown; maxWait?: unknown } = {};
  return { db: { calls: () => calls, lastOpts: () => lastOpts, $transaction: async (fn: (tx: unknown) => Promise<unknown>, opts: typeof lastOpts) => { calls++; lastOpts = opts; return behavior(fn, calls); } } as unknown as PrismaClient & { calls: () => number; lastOpts: () => typeof lastOpts } };
}
describe("transactionWithRetry", () => {
  it("passes isolation options through", async () => {
    const { db } = makeDb(async (fn) => fn({}));
    await transactionWithRetry(db, async () => 1, { isolationLevel: "Serializable", timeoutMs: 5000 });
    expect((db as unknown as { lastOpts: () => { isolationLevel?: unknown; timeout?: unknown } }).lastOpts().isolationLevel).toBe("Serializable");
  });
  it("retries serialization failures then succeeds", async () => {
    const { db } = makeDb(async (fn, n) => { if (n < 3) throw new Error("could not serialize (40001)"); return fn({}); });
    const r = await transactionWithRetry(db, async () => "ok", { retries: 3, baseDelayMs: 1 });
    expect(r.ok).toBe(true);
    expect((db as unknown as { calls: () => number }).calls()).toBe(3);
  });
  it("does not retry explicit abort and preserves its code", async () => {
    const { db } = makeDb(async (fn) => fn({}));
    const r = await transactionWithRetry(db, async () => { abortTransaction("残高不足"); }, { retries: 3, baseDelayMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
    expect((db as unknown as { calls: () => number }).calls()).toBe(1);
  });
});
