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

describe("終わったジョブを残し続けない", () => {
  /** createQueue に渡された設定を取り出す。 */
  function optionsOf(): { removeOnComplete?: { age?: number; count?: number }; removeOnFail?: { age?: number; count?: number } } {
    let opts: { defaultJobOptions?: Record<string, unknown> } = {};
    const factory = (_n: string, o: unknown): QueueLike => {
      opts = o as typeof opts;
      return { add: async () => {}, close: async () => {} };
    };
    createQueue("t", { url: "redis://h" }, factory);
    return opts.defaultJobOptions as ReturnType<typeof optionsOf>;
  }

  // **BullMQ は既定で永久に保持する。** 日次 1 万件なら 1 年で 365 万件が
  // Redis に残り、メモリを食い尽くすまで気づかない
  it("完了ジョブは時間と件数で消す", () => {
    const o = optionsOf();
    expect(o.removeOnComplete?.age).toBeGreaterThan(0);
    expect(o.removeOnComplete?.count).toBeGreaterThan(0);
  });
  // **失敗は調査に要るので長く残す。** 完了より長いことを固定する
  it("失敗ジョブは完了より長く残す", () => {
    const o = optionsOf();
    expect(o.removeOnFail?.age).toBeGreaterThan(o.removeOnComplete?.age ?? 0);
    expect(o.removeOnFail?.count).toBeGreaterThan(o.removeOnComplete?.count ?? 0);
  });
});
