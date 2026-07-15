import { describe, it, expect, vi } from "vitest";

// BullMQ(Redis 接続)をモックし、投入インターフェースの挙動のみ検証する。
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn().mockResolvedValue({});
    close = vi.fn().mockResolvedValue(undefined);
  },
  Worker: class {},
}));

import { createQueue } from "./index.js";

describe("jobs", () => {
  it("add はジョブを投入して ok を返す", async () => {
    const q = createQueue<{ to: string }>("emails", { url: "redis://localhost:6379" });
    const res = await q.add("welcome", { to: "a@example.co.jp" });
    expect(res.ok).toBe(true);
  });
});
