import { describe, it, expect } from "vitest";
import { formatSseEvent, SseDecoder } from "./sse.js";

describe("sse", () => {
  it("format", () => { expect(formatSseEvent({ event: "u", data: "hi", id: "1" })).toBe("id: 1\nevent: u\ndata: hi\n\n"); expect(formatSseEvent({ data: "a\nb" })).toBe("data: a\ndata: b\n\n"); });
  it("parse round-trip", () => { const p = new SseDecoder().push(formatSseEvent({ event: "m", data: "world", id: "7" })); expect(p[0]).toMatchObject({ event: "m", data: "world", id: "7" }); });
  it("multi-line data + comments", () => { expect(new SseDecoder().push(": c\ndata: x\ndata: y\n\n")[0]!.data).toBe("x\ny"); });
  it("fragmented events", () => { const d = new SseDecoder(); expect(d.push("data: a\n\ndata: b")).toHaveLength(1); expect(d.push("\n\n")[0]!.data).toBe("b"); });
});
