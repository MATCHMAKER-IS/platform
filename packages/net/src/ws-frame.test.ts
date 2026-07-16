import { describe, it, expect } from "vitest";
import { encodeWsFrame, encodeWsText, WsFrameDecoder, WsOpcode } from "./ws-frame";

const enc = new TextEncoder(); const dec = new TextDecoder();

describe("ws frame", () => {
  it("text round-trip", () => { const f = new WsFrameDecoder().push(encodeWsFrame({ opcode: WsOpcode.text, payload: enc.encode("hello") })); expect(dec.decode(f[0]!.payload)).toBe("hello"); });
  it("masked round-trip", () => { const f = encodeWsFrame({ opcode: WsOpcode.text, payload: enc.encode("m!"), mask: true, maskKey: new Uint8Array([1, 2, 3, 4]) }); expect((f[1]! & 0x80) !== 0).toBe(true); expect(dec.decode(new WsFrameDecoder().push(f)[0]!.payload)).toBe("m!"); });
  it("extended lengths 126/127", () => {
    expect(new WsFrameDecoder().push(encodeWsFrame({ opcode: 2, payload: enc.encode("y".repeat(200)) }))[0]!.payload.length).toBe(200);
    expect(new WsFrameDecoder().push(encodeWsFrame({ opcode: 2, payload: enc.encode("z".repeat(70000)) }))[0]!.payload.length).toBe(70000);
  });
  it("fragmented", () => { const d = new WsFrameDecoder(); const w = encodeWsFrame({ opcode: 1, payload: enc.encode("frag") }); expect(d.push(w.slice(0, 4))).toHaveLength(0); expect(dec.decode(d.push(w.slice(4))[0]!.payload)).toBe("frag"); });
  it("opcodes + encodeWsText", () => { expect(new WsFrameDecoder().push(encodeWsFrame({ opcode: WsOpcode.ping }))[0]!.opcode).toBe(0x9); expect((encodeWsText("hi")[1]! & 0x80) !== 0).toBe(true); });
});
