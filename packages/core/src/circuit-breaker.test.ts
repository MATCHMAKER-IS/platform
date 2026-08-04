import { describe, it, expect, vi } from "vitest";
import { createCircuitBreaker } from "./circuit-breaker";
import { AppError, ErrorCode } from "./error";

const boom = () => Promise.reject(new Error("boom"));
const ok = () => Promise.resolve("ok");

describe("createCircuitBreaker(状態遷移)", () => {
  it("失敗が閾値に達したら open", async () => {
    const b = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1_000 });
    for (let i = 0; i < 3; i += 1) await expect(b.execute(boom)).rejects.toThrow();
    expect(b.stats().state).toBe("open");
  });

  it("**open のときは呼ばずに即座に失敗する**（これが目的）", async () => {
    const b = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1_000 });
    await expect(b.execute(boom)).rejects.toThrow();
    const fn = vi.fn(ok);
    await expect(b.execute(fn)).rejects.toThrow();
    // **相手を呼んでいない**
    expect(fn).not.toHaveBeenCalled();
    expect(b.stats().rejectedCalls).toBe(1);
  });

  it("一定時間後は half-open になる", async () => {
    let t = 0;
    const b = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => t });
    await expect(b.execute(boom)).rejects.toThrow();
    expect(b.stats().state).toBe("open");
    t = 101;
    expect(b.stats().state).toBe("half-open");
  });

  it("half-open で成功すれば closed に戻る", async () => {
    let t = 0;
    const b = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => t });
    await expect(b.execute(boom)).rejects.toThrow();
    t = 101;
    await expect(b.execute(ok)).resolves.toBe("ok");
    expect(b.stats().state).toBe("closed");
  });

  it("**half-open で失敗したら即座に open へ戻す**（回復しかけを潰さない）", async () => {
    let t = 0;
    const b = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => t });
    await expect(b.execute(boom)).rejects.toThrow();
    t = 101;
    await expect(b.execute(boom)).rejects.toThrow();
    expect(b.stats().state).toBe("open");
  });

  it("成功が続けば連続失敗数がリセットされる", async () => {
    const b = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1_000 });
    await expect(b.execute(boom)).rejects.toThrow();
    await expect(b.execute(boom)).rejects.toThrow();
    await b.execute(ok);
    expect(b.stats().consecutiveFailures).toBe(0);
    // もう 2 回失敗しても閾値に届かない
    await expect(b.execute(boom)).rejects.toThrow();
    await expect(b.execute(boom)).rejects.toThrow();
    expect(b.stats().state).toBe("closed");
  });
});

describe("isFailure(数えない失敗)", () => {
  it("**入力エラーでは遮断しない**（相手が落ちたわけではない）", async () => {
    const b = createCircuitBreaker({
      failureThreshold: 2, resetTimeoutMs: 100,
      isFailure: (e) => !(e instanceof AppError && e.code === ErrorCode.VALIDATION),
    });
    for (let i = 0; i < 5; i += 1) {
      await expect(b.execute(() => Promise.reject(new AppError(ErrorCode.VALIDATION, "不正")))).rejects.toThrow();
    }
    expect(b.stats().state).toBe("closed");
  });

  it("対象の失敗なら遮断する", async () => {
    const b = createCircuitBreaker({
      failureThreshold: 2, resetTimeoutMs: 100,
      isFailure: (e) => !(e instanceof AppError && e.code === ErrorCode.VALIDATION),
    });
    await expect(b.execute(boom)).rejects.toThrow();
    await expect(b.execute(boom)).rejects.toThrow();
    expect(b.stats().state).toBe("open");
  });
});

describe("half-open の同時実行制限", () => {
  it("**通す数を制限する**（一斉に流すと回復しかけた相手を再び落とす）", async () => {
    let t = 0;
    const b = createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, halfOpenMaxCalls: 1, now: () => t });
    await expect(b.execute(boom)).rejects.toThrow();
    t = 101;

    // 1 本目を止めたまま 2 本目を投げる
    let release: (v: string) => void = () => {};
    const slow = new Promise<string>((r) => { release = r; });
    const first = b.execute(() => slow);
    await expect(b.execute(ok)).rejects.toThrow();

    release("ok");
    await first;
  });
});

describe("手動操作", () => {
  it("trip で開き、reset で閉じる", () => {
    const b = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1_000 });
    b.trip();
    expect(b.stats().state).toBe("open");
    b.reset();
    expect(b.stats().state).toBe("closed");
  });
});

describe("onStateChange(状態の通知)", () => {
  it("状態が変わったら呼ばれる", async () => {
    const changes: string[] = [];
    const b = createCircuitBreaker({
      failureThreshold: 1, resetTimeoutMs: 100,
      onStateChange: (from, to) => changes.push(`${from}->${to}`),
    });
    await expect(b.execute(boom)).rejects.toThrow();
    expect(changes).toContain("closed->open");
  });

  it("同じ状態への遷移では呼ばれない", () => {
    const changes: string[] = [];
    const b = createCircuitBreaker({
      failureThreshold: 1, resetTimeoutMs: 100,
      onStateChange: (from, to) => changes.push(`${from}->${to}`),
    });
    b.reset();
    expect(changes).toHaveLength(0);
  });
});

describe("stats(様子)", () => {
  it("累計と遮断数を数える", async () => {
    const b = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1_000 });
    await b.execute(ok);
    await expect(b.execute(boom)).rejects.toThrow();
    await expect(b.execute(boom)).rejects.toThrow();
    await expect(b.execute(ok)).rejects.toThrow();
    const s = b.stats();
    expect(s.totalCalls).toBe(3);
    expect(s.totalFailures).toBe(2);
    expect(s.rejectedCalls).toBe(1);
  });
});
