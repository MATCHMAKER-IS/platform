import { describe, it, expect } from "vitest";
import { encodeLengthPrefixed, LengthPrefixedDecoder, LineDecoder, encodeLine } from "./framing.js";

const enc = new TextEncoder(); const dec = new TextDecoder();

describe("framing", () => {
  it("length-prefixed round-trip", () => { const d = new LengthPrefixedDecoder(); expect(dec.decode(d.push(encodeLengthPrefixed(enc.encode("hello")))[0])).toBe("hello"); });
  it("concatenated frames", () => { const two = new Uint8Array([...encodeLengthPrefixed(enc.encode("ab")), ...encodeLengthPrefixed(enc.encode("cde"))]); const m = new LengthPrefixedDecoder().push(two); expect(m.map((x) => dec.decode(x))).toEqual(["ab", "cde"]); });
  it("fragmented", () => { const d = new LengthPrefixedDecoder(); const w = encodeLengthPrefixed(enc.encode("frag")); expect(d.push(w.slice(0, 3))).toHaveLength(0); expect(dec.decode(d.push(w.slice(3))[0])).toBe("frag"); });
  it("max frame guard", () => expect(() => new LengthPrefixedDecoder(2).push(encodeLengthPrefixed(enc.encode("toolong")))).toThrow());
  it("line decoder", () => { const l = new LineDecoder(); expect(l.push(enc.encode("a\r\nb\nc"))).toEqual(["a", "b"]); expect(l.flush()).toBe("c"); expect(dec.decode(encodeLine("x"))).toBe("x\n"); });
});
