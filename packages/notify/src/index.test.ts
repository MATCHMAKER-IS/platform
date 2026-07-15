import { describe, it, expect, vi, afterEach } from "vitest";
import { createNotifier, createSlackChannel } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("notify", () => {
  it("全チャネルへ送信し成功を返す", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = f as unknown as typeof fetch;
    const notifier = createNotifier([createSlackChannel("https://hooks.slack.test/x")]);
    const res = await notifier.notify({ text: "テスト", level: "info" });
    expect(res.ok).toBe(true);
    expect(f).toHaveBeenCalledOnce();
  });

  it("チャネルが失敗したら EXTERNAL エラー", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const notifier = createNotifier([createSlackChannel("https://hooks.slack.test/x")]);
    const res = await notifier.notify({ text: "x" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("EXTERNAL");
  });
});
