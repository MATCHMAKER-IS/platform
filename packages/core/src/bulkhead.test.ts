import { describe, it, expect } from "vitest";
import { createBulkhead } from "./bulkhead";
import { AppError } from "./error";
const defer = () => { let r!: () => void; const p = new Promise<void>((res) => (r = res)); return { p, resolve: r }; };
describe("bulkhead", () => {
  it("limits concurrency and queues", async () => {
    const bh = createBulkhead({ maxConcurrent: 2 });
    const d1 = defer(), d2 = defer(), d3 = defer();
    const p1 = bh.run(() => d1.p), p2 = bh.run(() => d2.p), p3 = bh.run(() => d3.p);
    await new Promise((r) => setTimeout(r, 5));
    expect(bh.active()).toBe(2); expect(bh.queued()).toBe(1);
    d1.resolve(); d2.resolve(); d3.resolve();
    await Promise.all([p1, p2, p3]);
    expect(bh.active()).toBe(0);
  });
  it("rejects on queue overflow", async () => {
    const bh = createBulkhead({ maxConcurrent: 1, maxQueue: 0 });
    const d = defer();
    const p = bh.run(() => d.p);
    await new Promise((r) => setTimeout(r, 5));
    await expect(bh.run(() => Promise.resolve())).rejects.toBeInstanceOf(AppError);
    d.resolve(); await p;
  });
});
