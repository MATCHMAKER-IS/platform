import { describe, it, expect } from "vitest";
import { createRedisIdempotencyStore, type RedisIdempotencyClient } from "./idempotency-redis";
import { createSqlOutboxStore, type OutboxDbClient } from "./outbox-sql";
import type { OutboxMessage } from "./outbox";
describe("redis idempotency", () => {
  it("reserve/complete/get/delete", async () => {
    let clk = 0; const m = new Map<string, { val: string; exp: number }>();
    const c: RedisIdempotencyClient = {
      set: async (k, v, _p, ttl) => { const e = m.get(k); if (e && e.exp > clk) return null; m.set(k, { val: v, exp: clk + ttl }); return "OK"; },
      setValue: async (k, v, ttl) => { m.set(k, { val: v, exp: clk + ttl }); },
      get: async (k) => { const e = m.get(k); return e && e.exp > clk ? e.val : null; },
      del: async (k) => { m.delete(k); },
    };
    const s = createRedisIdempotencyStore(c, 5000);
    expect(await s.reserve("op", { status: "in_progress", createdAt: 0 })).toBeNull();
    expect((await s.reserve("op", { status: "in_progress", createdAt: 0 }))?.status).toBe("in_progress");
    await s.complete("op", { status: "completed", createdAt: 0 });
    expect((await s.get("op"))?.status).toBe("completed");
  });
});
describe("sql outbox", () => {
  it("add/fetch/markSent", async () => {
    const rows: OutboxMessage[] = [];
    const c: OutboxDbClient = {
      insert: async (m) => { rows.push({ ...m }); },
      selectPending: async (limit, now) => rows.filter((r) => r.status === "pending" && (r.nextAttemptAt === undefined || r.nextAttemptAt <= now)).slice(0, limit),
      updateSent: async (id) => { const r = rows.find((x) => x.id === id); if (r) r.status = "sent"; },
      updateFailed: async (id, err, att, next, status) => { const r = rows.find((x) => x.id === id); if (r) { r.attempts = att; r.status = status; r.nextAttemptAt = next; } },
    };
    let seq = 0; const store = createSqlOutboxStore(c, () => `id-${++seq}`, () => 0);
    await store.add("t", { a: 1 });
    expect(rows).toHaveLength(1);
    const pending = await store.fetchPending(10, 0);
    expect(pending).toHaveLength(1);
    await store.markSent("id-1");
    expect(rows[0]!.status).toBe("sent");
  });
});
