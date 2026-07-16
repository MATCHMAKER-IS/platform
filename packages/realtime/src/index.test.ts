import { describe, it, expect, vi } from "vitest";
import { backoffDelay, createPoller, createReconnectingWebSocket, type WebSocketLike } from "./index";

describe("backoffDelay", () => {
  it("指数増加・上限", () => {
    expect(backoffDelay(0, 500, 15000)).toBe(500);
    expect(backoffDelay(1, 500, 15000)).toBe(1000);
    expect(backoffDelay(3, 500, 15000)).toBe(4000);
    expect(backoffDelay(10, 500, 15000)).toBe(15000);
  });
});

describe("createPoller", () => {
  it("開始で即時実行 + scheduler 登録、stop で解除", () => {
    let cb: (() => void) | null = null;
    const scheduler = vi.fn((c: () => void) => { cb = c; return 1; });
    const clear = vi.fn();
    const fn = vi.fn();
    const p = createPoller(fn, 100, scheduler, clear);
    p.start();
    expect(fn).toHaveBeenCalledTimes(1);
    cb!(); cb!();
    expect(fn).toHaveBeenCalledTimes(3);
    p.stop();
    expect(clear).toHaveBeenCalledWith(1);
    expect(p.isRunning()).toBe(false);
  });
});

describe("createReconnectingWebSocket", () => {
  it("JSON を parse して onMessage、close 後は再接続しない", () => {
    const created: WebSocketLike[] = [];
    class FakeWs implements WebSocketLike {
      onopen = null; onclose = null; onerror = null; onmessage: ((e: { data: unknown }) => void) | null = null;
      send = vi.fn(); close = vi.fn();
      constructor() { created.push(this); }
    }
    const msgs: unknown[] = [];
    const rws = createReconnectingWebSocket("ws://x", { WebSocketImpl: FakeWs as never, onMessage: (d) => msgs.push(d) });
    created[0]!.onopen!();
    expect(rws.status()).toBe("open");
    created[0]!.onmessage!({ data: '{"v":1}' });
    expect(msgs[0]).toEqual({ v: 1 });
    rws.close();
    created[0]!.onclose!();
    expect(rws.status()).toBe("closed");
    expect(created).toHaveLength(1); // 再接続していない
  });
});
