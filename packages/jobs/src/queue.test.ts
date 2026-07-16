import { describe, it, expect } from "vitest";
import { connectionFromUrl, createQueue, type QueueLike } from "./index";
import { createMemoryQueue } from "./memory";
describe("jobs", () => {
  it("parses redis url", () => {
    expect(connectionFromUrl("redis://:pw@h:6380")).toMatchObject({ host: "h", port: 6380, password: "pw" });
    expect(connectionFromUrl("redis://h")).toMatchObject({ port: 6379 });
  });
  it("createQueue maps add result and sets defaults", async () => {
    let opts: { defaultJobOptions?: { attempts?: number } } = {};
    const added: unknown[] = [];
    const factory = (_n: string, o: unknown): QueueLike => { opts = o as typeof opts; return { add: async (n, d) => { added.push({ n, d }); }, close: async () => {} }; };
    const q = createQueue("emails", { url: "redis://h" }, factory);
    expect(opts.defaultJobOptions?.attempts).toBe(3);
    expect((await q.add("welcome", { to: "a" })).ok).toBe(true);
    const failFactory = (): QueueLike => ({ add: async () => { throw new Error("down"); }, close: async () => {} });
    const q2 = createQueue("x", { url: "redis://h" }, failFactory);
    expect((await q2.add("j", {})).ok).toBe(false);
  });
  it("memory queue retries and dead-letters", async () => {
    const q = createMemoryQueue<{ x: number }>({ attempts: 2 });
    q.process(async () => { throw new Error("always"); });
    await q.add("bad", { x: 1 }); await q.drain();
    expect(q.failed()).toHaveLength(1);
    expect(q.failed()[0]!.attempts).toBe(2);
  });
});
