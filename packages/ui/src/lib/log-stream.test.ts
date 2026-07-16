import { describe, it, expect } from "vitest";
import { createLogStream } from "./log-stream";

class FakeWs {
  handlers: Record<string, (ev: { data?: unknown }) => void> = {};
  closed = false;
  addEventListener(t: string, cb: (ev: { data?: unknown }) => void) { this.handlers[t] = cb; }
  emit(data: string) { this.handlers.message?.({ data }); }
  close() { this.closed = true; }
}

describe("createLogStream", () => {
  it("splits and dispatches lines", () => {
    let ws!: FakeWs;
    const stream = createLogStream({ url: "ws://x", wsFactory: (u) => (ws = new FakeWs()) });
    const got: string[] = [];
    const unsub = stream.subscribe((ls) => got.push(...ls));
    ws.emit("a\nb"); ws.emit("c");
    expect(got).toEqual(["a", "b", "c"]);
    unsub(); ws.emit("d");
    expect(got).toEqual(["a", "b", "c"]);
    stream.close();
    expect(ws.closed).toBe(true);
  });
});
