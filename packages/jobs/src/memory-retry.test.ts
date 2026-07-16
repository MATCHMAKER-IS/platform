import { describe, it, expect } from "vitest";
import { createMemoryQueue } from "./memory";
describe("memory queue retry", () => {
  it("retries then dead-letters", async () => {
    let tries = 0;
    const q = createMemoryQueue({ attempts: 3 });
    q.process(async () => { tries++; if (tries < 3) throw new Error("t"); });
    await q.add("j", {}); await q.drain();
    expect(tries).toBe(3); expect(q.failed()).toHaveLength(0);
    const q2 = createMemoryQueue({ attempts: 2 });
    q2.process(async () => { throw new Error("perm"); });
    await q2.add("bad", { x: 1 }); await q2.drain();
    expect(q2.failed()).toHaveLength(1);
    expect(q2.failed()[0]!.error).toBe("perm");
  });
  it("continues after a failure", async () => {
    const done: number[] = [];
    const q = createMemoryQueue({ attempts: 1 });
    q.process(async (d: { id?: number; bad?: boolean }) => { if (d.bad) throw new Error("x"); if (d.id) done.push(d.id); });
    await q.add("a", { id: 1 }); await q.add("b", { bad: true }); await q.add("c", { id: 3 });
    await q.drain();
    expect(done).toEqual([1, 3]);
  });
});
