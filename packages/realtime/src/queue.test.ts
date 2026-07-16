import { describe, it, expect } from "vitest";
import { createReconnectingWebSocket, type WebSocketLike } from "./index";
class FakeWS implements WebSocketLike {
  sent: string[] = []; onopen: ((e?: unknown) => void) | null = null; onclose: ((e?: unknown) => void) | null = null; onerror: ((e?: unknown) => void) | null = null; onmessage: ((e: { data: unknown }) => void) | null = null;
  static instances: FakeWS[] = [];
  constructor(_url: string) { FakeWS.instances.push(this); }
  send(d: string) { this.sent.push(d); }
  close() { this.onclose?.(); }
}
describe("reconnecting ws send queue", () => {
  it("buffers while disconnected and flushes on open", () => {
    FakeWS.instances = [];
    const rws = createReconnectingWebSocket("wss://x", { WebSocketImpl: FakeWS, scheduleReconnect: () => {} });
    rws.send({ n: 1 }); rws.send({ n: 2 });
    expect(rws.pending()).toBe(2);
    FakeWS.instances[0]!.onopen?.();
    expect(FakeWS.instances[0]!.sent).toHaveLength(2);
    expect(rws.pending()).toBe(0);
  });
  it("respects maxQueueSize", () => {
    FakeWS.instances = [];
    const rws = createReconnectingWebSocket("wss://z", { WebSocketImpl: FakeWS, scheduleReconnect: () => {}, maxQueueSize: 2 });
    for (let i = 0; i < 5; i++) rws.send({ i });
    expect(rws.pending()).toBe(2);
  });
});
