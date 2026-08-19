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

describe("待機キューの既定", () => {
  // **バルクヘッドの目的は「遅い依存が資源を食い潰すのを防ぐ」こと。**
  // 待機列が無制限だとまさにそれが起きる(2026-08 に既定を有限にした)
  it("maxQueue を省いても無制限にはならない", async () => {
    const b = createBulkhead({ maxConcurrent: 1 });
    // 1 件を実行中にして、残りを待機させる
    let release = (): void => {};
    const held = b.run(() => new Promise<void>((r) => { release = r; }));
    // 既定の上限まで積んでから、さらに 1 件で拒否されることを確かめる
    const waiting = Array.from({ length: 1000 }, () => b.run(async () => {}));
    await expect(b.run(async () => {})).rejects.toThrow();
    release();
    await held;
    await Promise.allSettled(waiting);
  });
});
