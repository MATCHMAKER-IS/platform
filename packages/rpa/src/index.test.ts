import { describe, it, expect } from "vitest";
import { createRpaRunner, type RpaAuditEvent, type RpaLock } from "./index";

/** テスト用のロック(取得の成否を並べて指定できる)。 */
function fakeLock(results: boolean[] = []): RpaLock & { acquired: string[]; released: string[] } {
  const acquired: string[] = [];
  const released: string[] = [];
  let i = 0;
  return {
    acquired, released,
    async acquire(key) { acquired.push(key); return results[i++] ?? true; },
    async release(key) { released.push(key); },
  };
}

/** 冪等キーの記録。 */
function fakeSeen(initial: string[] = []) {
  const set = new Set(initial);
  return { set, async has(k: string) { return set.has(k); }, async add(k: string) { set.add(k); } };
}

/** 監査の記録。 */
function fakeAudit() {
  const events: RpaAuditEvent[] = [];
  return { events, sink: (e: RpaAuditEvent) => { events.push(e); } };
}

describe("基本の実行", () => {
  it("成功したら値と試行回数を返す", async () => {
    const runner = createRpaRunner();
    const r = await runner.run({ name: "t", run: async () => "ok" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.value).toBe("ok");
    expect(r.value.attempts).toBe(1);
    expect(r.value.skipped).toBe(false);
    expect(r.value.runId.length).toBeGreaterThan(0);
  });

  it("失敗したら EXTERNAL で返す(例外を投げない)", async () => {
    const runner = createRpaRunner();
    const r = await runner.run({ name: "t", run: async () => { throw new Error("画面が開けません"); } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("EXTERNAL");
    expect(r.error.message).toContain("画面が開けません");
  });
});

describe("冪等(同じ処理を二度実行しない)", () => {
  it("**記録済みのキーはスキップする**", async () => {
    const seen = fakeSeen(["2026-07-daily"]);
    let ran = false;
    const runner = createRpaRunner({ seenStore: seen });
    const r = await runner.run({
      name: "t", idempotencyKey: "2026-07-daily",
      run: async () => { ran = true; return 1; },
    });
    expect(ran).toBe(false);
    expect(r.ok && r.value.skipped).toBe(true);
    expect(r.ok && r.value.attempts).toBe(0);
  });

  it("成功したらキーを記録する(次回はスキップされる)", async () => {
    const seen = fakeSeen();
    const runner = createRpaRunner({ seenStore: seen });
    await runner.run({ name: "t", idempotencyKey: "k1", run: async () => 1 });
    expect(seen.set.has("k1")).toBe(true);
  });

  it("**失敗したらキーを記録しない**(再実行できる)", async () => {
    // 記録してしまうと、失敗したまま二度と実行されなくなる
    const seen = fakeSeen();
    const runner = createRpaRunner({ seenStore: seen });
    await runner.run({ name: "t", idempotencyKey: "k1", run: async () => { throw new Error("失敗"); } });
    expect(seen.set.has("k1")).toBe(false);
  });

  it("キーが無ければ毎回実行する", async () => {
    const seen = fakeSeen();
    const runner = createRpaRunner({ seenStore: seen });
    let count = 0;
    await runner.run({ name: "t", run: async () => { count += 1; } });
    await runner.run({ name: "t", run: async () => { count += 1; } });
    expect(count).toBe(2);
  });
});

describe("ロック(直列化)", () => {
  it("取得できたら実行し、**必ず解放する**", async () => {
    const lock = fakeLock([true]);
    const runner = createRpaRunner({ lock });
    await runner.run({ name: "t", lockKey: "chromium", run: async () => 1 });
    expect(lock.acquired).toEqual(["chromium"]);
    expect(lock.released).toEqual(["chromium"]);
  });

  it("**失敗しても解放する**(解放漏れで以降ずっと動かなくなるのを防ぐ)", async () => {
    const lock = fakeLock([true]);
    const runner = createRpaRunner({ lock });
    await runner.run({ name: "t", lockKey: "chromium", run: async () => { throw new Error("x"); } });
    expect(lock.released).toEqual(["chromium"]);
  });

  it("取得できず待ち時間も無ければ CONFLICT(待たずに諦める)", async () => {
    const lock = fakeLock([false]);
    const runner = createRpaRunner({ lock });
    const r = await runner.run({ name: "t", lockKey: "chromium", run: async () => 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("CONFLICT");
  });

  it("待ち時間を指定すれば取得できるまで再試行する", async () => {
    const lock = fakeLock([false, false, true]);
    let slept = 0;
    const runner = createRpaRunner({ lock, sleep: async (ms) => { slept += ms; } });
    const r = await runner.run({ name: "t", lockKey: "chromium", lockWaitMs: 5_000, run: async () => 1 });
    expect(r.ok).toBe(true);
    expect(lock.acquired.length).toBe(3);
    expect(slept).toBeGreaterThan(0);
  });

  it("**取れなかったロックは解放しない**(他人のロックを消さない)", async () => {
    const lock = fakeLock([false]);
    const runner = createRpaRunner({ lock });
    await runner.run({ name: "t", lockKey: "chromium", run: async () => 1 });
    expect(lock.released).toEqual([]);
  });
});

describe("リトライ", () => {
  it("失敗しても maxAttempts まで試す", async () => {
    let count = 0;
    const runner = createRpaRunner({ sleep: async () => {} });
    const r = await runner.run({
      name: "t", retry: { maxAttempts: 3 },
      run: async () => { count += 1; if (count < 3) throw new Error("一時的"); return "ok"; },
    });
    expect(r.ok && r.value.attempts).toBe(3);
    expect(count).toBe(3);
  });

  it("**再試行しても無駄なエラーは即座に諦める**", async () => {
    let count = 0;
    const runner = createRpaRunner({ sleep: async () => {} });
    await runner.run({
      name: "t",
      retry: { maxAttempts: 3, isRetryable: () => false },
      run: async () => { count += 1; throw new Error("恒久的"); },
    });
    expect(count).toBe(1);
  });

  it("待ち時間は指数的に伸びる(相手を叩き続けない)", async () => {
    const waits: number[] = [];
    const runner = createRpaRunner({ sleep: async (ms) => { waits.push(ms); } });
    await runner.run({
      name: "t", retry: { maxAttempts: 3, baseDelayMs: 100 },
      run: async () => { throw new Error("x"); },
    });
    expect(waits).toEqual([100, 200]);
  });

  it("既定は 1 回だけ(黙って何度も実行しない)", async () => {
    let count = 0;
    const runner = createRpaRunner();
    await runner.run({ name: "t", run: async () => { count += 1; throw new Error("x"); } });
    expect(count).toBe(1);
  });
});

describe("タイムアウト", () => {
  it("**時間を過ぎたら中断を伝える**", async () => {
    const runner = createRpaRunner();
    const r = await runner.run({
      name: "t", timeoutMs: 10,
      run: async (ctx) => {
        await new Promise((res) => setTimeout(res, 30));
        expect(ctx.signal.aborted).toBe(true); // 処理側が中断に気づける
        return "遅れて完了";
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("タイムアウト");
  });

  it("時間内なら普通に成功する", async () => {
    const runner = createRpaRunner();
    const r = await runner.run({ name: "t", timeoutMs: 1_000, run: async () => "ok" });
    expect(r.ok && r.value.value).toBe("ok");
  });
});

describe("監査(誰が何をしたか残す)", () => {
  it("開始と成功を記録する", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink, actor: "batch" });
    await runner.run({ name: "point-sync", run: async () => 1 });
    expect(audit.events.map((e) => e.action)).toEqual(["rpa.start", "rpa.success"]);
    expect(audit.events[0]?.actor).toBe("batch");
    expect(audit.events[0]?.target).toBe("point-sync");
  });

  it("失敗も記録する(**エラー内容つき**)", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink });
    await runner.run({ name: "t", run: async () => { throw new Error("画面が開けません"); } });
    const errorEvent = audit.events.find((e) => e.action === "rpa.error");
    expect(errorEvent?.metadata?.error).toBe("画面が開けません");
  });

  it("スキップも記録する(なぜ動かなかったか分かる)", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink, seenStore: fakeSeen(["k1"]) });
    await runner.run({ name: "t", idempotencyKey: "k1", run: async () => 1 });
    expect(audit.events.map((e) => e.action)).toEqual(["rpa.skip"]);
  });

  it("ロック待ちの打ち切りも記録する", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink, lock: fakeLock([false]) });
    await runner.run({ name: "t", lockKey: "chromium", run: async () => 1 });
    expect(audit.events.map((e) => e.action)).toContain("rpa.lock_timeout");
  });

  it("**処理の途中からも記録できる**(どこまで進んだか追える)", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink });
    await runner.run({
      name: "t",
      run: async (ctx) => { await ctx.audit("open_browser", { url: "https://example" }); },
    });
    const step = audit.events.find((e) => e.action === "open_browser");
    expect(step?.metadata?.url).toBe("https://example");
    expect(step?.metadata?.attempt).toBe(1);
  });

  it("同じ実行の記録は runId で束ねられる", async () => {
    const audit = fakeAudit();
    const runner = createRpaRunner({ audit: audit.sink });
    const r = await runner.run({ name: "t", run: async (ctx) => { await ctx.audit("step"); } });
    const ids = new Set(audit.events.map((e) => e.metadata?.runId));
    expect(ids.size).toBe(1);
    expect(r.ok && ids.has(r.value.runId)).toBe(true);
  });
});
