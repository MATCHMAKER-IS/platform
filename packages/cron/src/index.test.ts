import { describe, it, expect, vi } from "vitest";

// croner をモックして、登録・エラーハンドリングの挙動を検証する。
let lastCallback: (() => Promise<void>) | null = null;
vi.mock("croner", () => ({
  Cron: class {
    constructor(_schedule: string, _opts: unknown, cb: () => Promise<void>) {
      lastCallback = cb;
    }
    stop() {}
  },
}));

import { createScheduler } from "./index.js";

describe("cron", () => {
  it("ジョブ名を登録できる", () => {
    const s = createScheduler([{ name: "daily", schedule: "0 9 * * *", handler: async () => {} }]);
    expect(s.jobNames()).toEqual(["daily"]);
  });

  it("ハンドラの例外は onError に渡る(スケジューラは止まらない)", async () => {
    const onError = vi.fn();
    const s = createScheduler(
      [{ name: "boom", schedule: "* * * * *", handler: async () => { throw new Error("fail"); } }],
      onError,
    );
    s.start();
    await lastCallback?.();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toBe("boom");
  });
});
