import { describe, it, expect, afterAll } from "vitest";
import { createUdpSocket, type UdpSocket } from "./udp.js";

const enc = new TextEncoder(); const dec = new TextDecoder();
let a: UdpSocket, b: UdpSocket;
afterAll(async () => { await a?.close(); await b?.close(); });

describe("udp (real sockets)", () => {
  it("datagram round-trip", async () => {
    const got: string[] = [];
    b = await createUdpSocket({ host: "127.0.0.1" }, (m) => got.push(dec.decode(m)));
    a = await createUdpSocket({ host: "127.0.0.1" });
    await a.send(enc.encode("ping"), b.port, "127.0.0.1");
    await new Promise((r) => setTimeout(r, 80));
    expect(got).toContain("ping");
  });
});
