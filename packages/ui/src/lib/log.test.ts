import { describe, it, expect } from "vitest";
import { detectLogLevel, parseLogLines, filterLogLines, countByLevel, extractTimestamp, bucketByTime, logLinesToText, formatRelativeTime, parseStructuredLog, firstLineIndexAtOrAfter, collectFieldKeys, fieldFacets, filterByFields, appendCapped } from "./log.js";

describe("detectLogLevel", () => {
  it("ERROR", () => expect(detectLogLevel("2026 ERROR boom")).toBe("error"));
  it("WARN", () => expect(detectLogLevel("WARN slow")).toBe("warn"));
  it("first token wins", () => expect(detectLogLevel("INFO retrying after error")).toBe("info"));
  it("DEBUG/TRACE", () => { expect(detectLogLevel("TRACE x")).toBe("debug"); expect(detectLogLevel("DEBUG y")).toBe("debug"); });
  it("none", () => expect(detectLogLevel("plain line")).toBeNull());
});

describe("filter", () => {
  const parsed = parseLogLines(["INFO a", "WARN b", "ERROR c", "DEBUG d", "plain e"]);
  it("levels", () => expect(filterLogLines(parsed, { levels: ["error", "warn"] }).length).toBe(2));
  it("minLevel", () => expect(filterLogLines(parsed, { minLevel: "warn" }).map((p) => p.level).sort()).toEqual(["error", "warn"]));
  it("query AND", () => { expect(filterLogLines(parsed, { query: "warn b" }).length).toBe(1); expect(filterLogLines(parsed, { query: "warn c" }).length).toBe(0); });
  it("countByLevel", () => expect(countByLevel(parsed)).toEqual({ error: 1, warn: 1, info: 1, debug: 1, none: 1 }));
});

describe("timestamp/timeline/regex", () => {
  const parsed = parseLogLines(["2026-02-15 09:00:00 INFO a", "2026-02-15 09:00:30 WARN b", "2026-02-15 09:01:10 ERROR c", "no-ts DEBUG d"]);
  it("extractTimestamp", () => { expect(extractTimestamp("2026-02-15 09:00:00 x")).toBe(Date.parse("2026-02-15T09:00:00")); expect(extractTimestamp("none")).toBeNull(); });
  it("regex filter", () => expect(filterLogLines(parsed, { regex: "ERROR|WARN" }).length).toBe(2));
  it("invalid regex ignored", () => expect(filterLogLines(parsed, { regex: "([bad" }).length).toBe(4));
  it("bucketByTime", () => { const b = bucketByTime(parsed, 60000); expect(b.length).toBe(2); expect(b[0].total).toBe(2); });
  it("logLinesToText", () => expect(logLinesToText(parsed.slice(0, 1))).toBe("2026-02-15 09:00:00 INFO a"));
  it("formatRelativeTime string", () => expect(typeof formatRelativeTime(0, 60000, "en")).toBe("string"));
});

describe("structured log", () => {
  it("json", () => {
    const j = parseStructuredLog('{"level":"error","msg":"boom","ts":"2026-02-15T09:00:00Z","code":500}');
    expect(j?.level).toBe("error"); expect(j?.message).toBe("boom"); expect(j?.fields.code).toBe("500");
  });
  it("logfmt", () => {
    const lf = parseStructuredLog('level=info msg="done" dur=12ms');
    expect(lf?.level).toBe("info"); expect(lf?.message).toBe("done"); expect(lf?.fields.dur).toBe("12ms");
  });
  it("plain -> null", () => expect(parseStructuredLog("plain text")).toBeNull());
  it("parseLogLines structured", () => {
    const p = parseLogLines(['{"level":"warn","msg":"x","ts":"2026-02-15T09:00:00Z"}'], { structured: true });
    expect(p[0].level).toBe("warn"); expect(p[0].message).toBe("x");
  });
  it("firstLineIndexAtOrAfter", () => {
    const p = parseLogLines(["2026-02-15 09:00:00 INFO a", "2026-02-15 09:01:00 WARN b"]);
    expect(firstLineIndexAtOrAfter(p, Date.parse("2026-02-15T09:00:30"))).toBe(1);
  });
});

describe("facets/fields/buffer", () => {
  const parsed = parseLogLines([
    '{"level":"info","msg":"a","path":"/x","user":"taro"}',
    '{"level":"error","msg":"b","path":"/y","user":"taro"}',
    '{"level":"warn","msg":"c","path":"/x","user":"hanako"}',
  ], { structured: true });
  it("collectFieldKeys", () => expect(collectFieldKeys(parsed)).toEqual(["level", "msg", "path", "user"]));
  it("fieldFacets", () => expect(fieldFacets(parsed, "path")[0]).toEqual({ value: "/x", count: 2 }));
  it("filterByFields AND", () => expect(filterByFields(parsed, { path: ["/x"], user: ["hanako"] }).length).toBe(1));
  it("filterByFields OR", () => expect(filterByFields(parsed, { user: ["taro", "hanako"] }).length).toBe(3));
  it("appendCapped", () => expect(appendCapped([1, 2, 3], [4, 5], 4)).toEqual([2, 3, 4, 5]));
});
