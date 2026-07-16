import { describe, it, expect } from "vitest";
import { createDebugCollector, summarizeSql, findIssues } from "./debug";

describe("createDebugCollector", () => {
  const fixedNow = () => {
    let t = 1000;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
  };

  it("リクエストの開始・記録・完了を追える", () => {
    const clock = fixedNow();
    const c = createDebugCollector({ enabled: true, now: clock.now });
    c.start({ requestId: "r1", method: "GET", path: "/api/x" });
    clock.advance(10);
    c.record("r1", { kind: "sql", label: "SELECT FROM \"User\"", durationMs: 5, ok: true });
    clock.advance(40);
    c.finish("r1", 200);

    const r = c.get("r1");
    expect(r?.status).toBe(200);
    expect(r?.durationMs).toBe(50);
    expect(r?.events[0]?.atMs).toBe(10);
  });

  it("本番(enabled:false)では記録も保持もしない", () => {
    const c = createDebugCollector({ enabled: false });
    c.start({ requestId: "x", method: "GET", path: "/x" });
    c.record("x", { kind: "sql", label: "s", durationMs: 1, ok: true });
    expect(c.list()).toHaveLength(0);
    expect(c.get("x")).toBeUndefined();
  });

  it("容量を超えたら古いものから捨てる", () => {
    const c = createDebugCollector({ enabled: true, capacity: 2 });
    for (const id of ["a", "b", "c"]) c.start({ requestId: id, method: "GET", path: "/x" });
    expect(c.list()).toHaveLength(2);
    expect(c.get("a")).toBeUndefined();
  });

  it("開始されていないリクエストへの記録は無視する(例外を投げない)", () => {
    const c = createDebugCollector({ enabled: true });
    expect(() => c.record("none", { kind: "sql", label: "s", durationMs: 1, ok: true })).not.toThrow();
  });

  it("種類別に集計し、重複 SQL を数える", () => {
    const c = createDebugCollector({ enabled: true });
    c.start({ requestId: "r", method: "GET", path: "/x" });
    for (let i = 0; i < 3; i += 1) c.record("r", { kind: "sql", label: "SELECT FROM \"User\"", durationMs: 2, ok: true });
    c.record("r", { kind: "ai", label: "claude", durationMs: 500, ok: true });
    const s = c.summarize(c.get("r")!);
    expect(s.counts.sql).toBe(3);
    expect(s.counts.ai).toBe(1);
    expect(s.duplicateSql).toBe(2);
    expect(s.durations.ai).toBe(500);
  });

  it("遅い SQL をしきい値で判定する", () => {
    const c = createDebugCollector({ enabled: true, slowSqlMs: 50 });
    c.start({ requestId: "r", method: "GET", path: "/x" });
    c.record("r", { kind: "sql", label: "a", durationMs: 60, ok: true });
    c.record("r", { kind: "sql", label: "b", durationMs: 10, ok: true });
    expect(c.summarize(c.get("r")!).slowSql).toBe(1);
  });
});

describe("summarizeSql", () => {
  it("動詞とテーブル名に短縮する", () => {
    expect(summarizeSql('SELECT "id" FROM "User" WHERE "id" = $1')).toBe('SELECT FROM "User"');
    expect(summarizeSql('INSERT INTO "Expense" ("a") VALUES ($1)')).toBe('INSERT INTO "Expense"');
    expect(summarizeSql('UPDATE "User" SET "x" = 1')).toBe('UPDATE "User"');
    expect(summarizeSql('DELETE FROM "Log" WHERE x')).toBe('DELETE FROM "Log"');
  });

  it("解析できないものはそのまま(長ければ切り詰め)", () => {
    expect(summarizeSql("BEGIN")).toBe("BEGIN");
    expect(summarizeSql("X".repeat(100), 10)).toHaveLength(11); // 10 + …
  });
});

describe("findIssues", () => {
  it("N+1・遅い SQL・失敗・遅さを指摘する", () => {
    const c = createDebugCollector({ enabled: true });
    c.start({ requestId: "r", method: "GET", path: "/x" });
    for (let i = 0; i < 5; i += 1) c.record("r", { kind: "sql", label: "SELECT FROM \"User\"", durationMs: 2, ok: true });
    c.record("r", { kind: "api", label: "https://x", durationMs: 10, ok: false });
    c.finish("r", 200);
    const req = c.get("r")!;
    const issues = findIssues(req, c.summarize(req));
    expect(issues.some((i) => i.includes("N+1"))).toBe(true);
    expect(issues.some((i) => i.includes("失敗した処理"))).toBe(true);
  });

  it("問題がなければ空", () => {
    const c = createDebugCollector({ enabled: true });
    c.start({ requestId: "r", method: "GET", path: "/x" });
    c.record("r", { kind: "sql", label: "SELECT FROM \"User\"", durationMs: 2, ok: true });
    c.finish("r", 200);
    const req = c.get("r")!;
    expect(findIssues(req, c.summarize(req))).toHaveLength(0);
  });
});
