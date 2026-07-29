import { describe, it, expect } from "vitest";
import { runSaga, sagaStep, type SagaStep } from "./index";

/** 実行順を記録する文脈。 */
interface Ctx { log: string[] }

const step = (name: string, opts: { fail?: boolean; compensate?: boolean; compensateFails?: boolean } = {}): SagaStep<Ctx> => ({
  name,
  run: (ctx) => {
    ctx.log.push(`run:${name}`);
    if (opts.fail) throw new Error(`${name} が失敗`);
  },
  ...(opts.compensate === false ? {} : {
    compensate: (ctx) => {
      ctx.log.push(`undo:${name}`);
      if (opts.compensateFails) throw new Error(`${name} の打ち消しが失敗`);
    },
  }),
});

describe("すべて成功したとき", () => {
  it("順番に実行し、打ち消しはしない", async () => {
    const ctx: Ctx = { log: [] };
    const r = await runSaga([step("a"), step("b"), step("c")], ctx);
    expect(r.ok).toBe(true);
    expect(ctx.log).toEqual(["run:a", "run:b", "run:c"]);
    expect(r.compensated).toEqual([]);
  });

  it("確定したステップ名を返す", async () => {
    const r = await runSaga([step("a"), step("b")], { log: [] });
    expect(r.completed).toEqual(["a", "b"]);
  });

  it("ステップが空でも成功扱い", async () => {
    const r = await runSaga([], { log: [] });
    expect(r.ok).toBe(true);
    expect(r.completed).toEqual([]);
  });
});

describe("途中で失敗したとき", () => {
  it("**成功済みを逆順で打ち消す**(依存関係の逆順で戻す)", async () => {
    const ctx: Ctx = { log: [] };
    const r = await runSaga([step("a"), step("b"), step("c", { fail: true }), step("d")], ctx);
    expect(r.ok).toBe(false);
    expect(ctx.log).toEqual(["run:a", "run:b", "run:c", "undo:b", "undo:a"]);
    expect(r.compensated).toEqual(["b", "a"]);
  });

  it("**失敗したステップ自身は打ち消さない**(その処理は成立していない)", async () => {
    const ctx: Ctx = { log: [] };
    await runSaga([step("a"), step("b", { fail: true })], ctx);
    expect(ctx.log).not.toContain("undo:b");
  });

  it("失敗以降のステップは実行しない", async () => {
    const ctx: Ctx = { log: [] };
    await runSaga([step("a", { fail: true }), step("b")], ctx);
    expect(ctx.log).not.toContain("run:b");
  });

  it("失敗したステップ名と原因を返す", async () => {
    const r = await runSaga([step("a"), step("b", { fail: true })], { log: [] });
    expect(r.failedStep).toBe("b");
    expect((r.error as Error).message).toBe("b が失敗");
  });

  it("**completed は空になる**(打ち消したので確定していない)", async () => {
    const r = await runSaga([step("a"), step("b", { fail: true })], { log: [] });
    expect(r.completed).toEqual([]);
  });

  it("打ち消しが無いステップは飛ばす(打ち消し済みには数えない)", async () => {
    const ctx: Ctx = { log: [] };
    const r = await runSaga([
      step("a"),
      step("b", { compensate: false }),
      step("c", { fail: true }),
    ], ctx);
    expect(r.compensated).toEqual(["a"]);
    expect(ctx.log.filter((l) => l.startsWith("undo:"))).toEqual(["undo:a"]);
  });
});

describe("打ち消し自体が失敗したとき", () => {
  it("**他の打ち消しは続行する**(1 つ失敗しても残りを戻す)", async () => {
    const ctx: Ctx = { log: [] };
    const r = await runSaga([
      step("a"),
      step("b", { compensateFails: true }),
      step("c", { fail: true }),
    ], ctx);
    expect(r.compensated).toEqual(["a"]);            // b は失敗したので含まない
    expect(ctx.log).toContain("undo:a");             // a は戻せた
  });

  it("**失敗した打ち消しを記録する**(手で戻す必要があるので)", async () => {
    const r = await runSaga([
      step("a", { compensateFails: true }),
      step("b", { fail: true }),
    ], { log: [] });
    expect(r.compensationErrors?.length).toBe(1);
    expect(r.compensationErrors?.[0]?.step).toBe("a");
  });

  it("打ち消しが全部成功したら compensationErrors は付けない", async () => {
    const r = await runSaga([step("a"), step("b", { fail: true })], { log: [] });
    expect("compensationErrors" in r).toBe(false);
  });
});

describe("非同期のステップ", () => {
  it("await して順に実行する(並列にしない)", async () => {
    const ctx: Ctx = { log: [] };
    const slow: SagaStep<Ctx> = {
      name: "slow",
      run: async (c) => { await new Promise((r) => setTimeout(r, 5)); c.log.push("run:slow"); },
    };
    await runSaga([slow, step("after")], ctx);
    expect(ctx.log).toEqual(["run:slow", "run:after"]);
  });

  it("非同期の打ち消しも await する", async () => {
    const ctx: Ctx = { log: [] };
    const asyncUndo: SagaStep<Ctx> = {
      name: "x",
      run: () => { ctx.log.push("run:x"); },
      compensate: async () => { await new Promise((r) => setTimeout(r, 5)); ctx.log.push("undo:x"); },
    };
    const r = await runSaga([asyncUndo, step("y", { fail: true })], ctx);
    expect(r.compensated).toEqual(["x"]);
    expect(ctx.log).toContain("undo:x");
  });
});

describe("sagaStep", () => {
  it("打ち消しを渡せばステップに含める", () => {
    const s = sagaStep<Ctx>("a", () => {}, () => {});
    expect(s.name).toBe("a");
    expect(typeof s.compensate).toBe("function");
  });

  it("**打ち消しを渡さなければキーごと付けない**(undefined を持たせない)", () => {
    expect("compensate" in sagaStep<Ctx>("a", () => {})).toBe(false);
  });

  it("組み立てたステップがそのまま動く", async () => {
    const ctx: Ctx = { log: [] };
    await runSaga([
      sagaStep<Ctx>("予約", (c) => { c.log.push("run:予約"); }, (c) => { c.log.push("undo:予約"); }),
      sagaStep<Ctx>("決済", () => { throw new Error("カードが通らない"); }),
    ], ctx);
    expect(ctx.log).toEqual(["run:予約", "undo:予約"]);
  });
});
