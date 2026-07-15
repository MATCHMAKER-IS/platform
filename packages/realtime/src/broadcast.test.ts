import { describe, it, expect } from "vitest";
import { createBroadcastHub, type RedisPubSubClient } from "./broadcast.js";
function makeBus() {
  const handlers = new Map<string, Set<(m: string) => void>>();
  return {
    client(): RedisPubSubClient {
      const mine: { channel: string; handler: (m: string) => void }[] = [];
      return {
        publish: async (c, m) => { handlers.get(c)?.forEach((h) => h(m)); },
        subscribe: async (c, h) => { if (!handlers.has(c)) handlers.set(c, new Set()); handlers.get(c)!.add(h); mine.push({ channel: c, handler: h }); },
        unsubscribe: async (c) => { mine.filter((e) => e.channel === c).forEach((e) => handlers.get(c)?.delete(e.handler)); },
      };
    },
  };
}
describe("broadcast hub", () => {
  it("delivers across instances without double-delivery", async () => {
    const bus = makeBus();
    const a = createBroadcastHub(bus.client()); const b = createBroadcastHub(bus.client());
    const ra: string[] = []; const rb: string[] = [];
    await a.subscribe("room", "1", (d) => ra.push(d));
    await b.subscribe("room", "2", (d) => rb.push(d));
    await a.publish("room", { t: "hi" });
    expect(ra).toHaveLength(1); expect(rb).toHaveLength(1);
    expect(JSON.parse(ra[0]!).t).toBe("hi");
  });
  it("unsubscribe stops delivery", async () => {
    const bus = makeBus();
    const a = createBroadcastHub(bus.client());
    const ra: string[] = [];
    await a.subscribe("r", "1", (d) => ra.push(d));
    await a.unsubscribe("r", "1");
    expect(a.localCount("r")).toBe(0);
    await a.publish("r", {});
    expect(ra).toHaveLength(0);
  });
});
