import { describe, it, expect, afterAll } from "vitest";
import { createFramedServer, connectFramed, type FramedServer } from "./tcp.js";

const enc = new TextEncoder(); const dec = new TextDecoder();
let server: FramedServer;
afterAll(() => server?.close());

describe("tcp framed (real sockets)", () => {
  it("echo round-trip preserves message boundaries", async () => {
    server = await createFramedServer({ host: "127.0.0.1" }, (payload, conn) => conn.send(enc.encode("echo:" + dec.decode(payload))));
    expect(server.port).toBeGreaterThan(0);
    const received: string[] = [];
    const client = await connectFramed({ host: "127.0.0.1", port: server.port }, (p) => received.push(dec.decode(p)));
    client.send(enc.encode("hello"));
    client.send(enc.encode("世界"));
    await new Promise((r) => setTimeout(r, 100));
    expect(received).toEqual(["echo:hello", "echo:世界"]);
    client.close();
  });
});
